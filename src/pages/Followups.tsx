import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { PageHeader, Card, Button, Badge, Spinner, Select, EmptyState, Input, Label, Textarea } from '../components/ui/primitives'
import { listFollowups, updateFollowup, createFollowup, buildWhatsAppLink } from '../services/feedback'
import { searchCustomers } from '../services/customers'
import type { Followup, FollowupStatus, Customer } from '../types/domain'
import { formatDate } from '../utils/format'
import { Modal } from '../components/common/Modal'
import { useAuth } from '../hooks/useAuth'

export function Followups() {
  const [items, setItems] = useState<Followup[]>([])
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const { profile } = useAuth()

  async function refresh() {
    setLoading(true)
    setItems(await listFollowups({ status: status || undefined }))
    setLoading(false)
  }
  useEffect(() => { refresh() }, [status])

  async function handleStatusChange(id: string, newStatus: FollowupStatus) {
    await updateFollowup(id, { status: newStatus })
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description="Scheduled outreach — feedback requests, review asks, repeat-purchase checks."
        actions={<Button onClick={() => setShowNew(true)}>+ Schedule Follow-up</Button>}
      />

      <div className="mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[200px]">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="contacted">Contacted</option>
          <option value="completed">Completed</option>
          <option value="not_interested">Not Interested</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState title="No follow-ups scheduled" description="Schedule a follow-up to remember to check in with a customer." action={<Button onClick={() => setShowNew(true)}>+ Schedule Follow-up</Button>} />
      ) : (
        <div className="space-y-3">
          {items.map((f) => {
            const waLink = f.customer ? buildWhatsAppLink(f.customer.phone, `Hi ${f.customer.name}, this is Sake of Health — ${f.reason}`) : '#'
            return (
              <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink-800">{f.customer?.name}</p>
                  <p className="text-sm text-ink-500">{f.reason}</p>
                  <p className="text-xs text-ink-400">Due {formatDate(f.followup_date)} · {f.contact_method}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={f.status} />
                  <a href={waLink} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button></a>
                  {f.status === 'pending' && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(f.id, 'contacted')}>Mark Contacted</Button>}
                  {f.status !== 'completed' && <Button size="sm" onClick={() => handleStatusChange(f.id, 'completed')}>Complete</Button>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showNew && (
        <NewFollowupModal userId={profile?.id} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); refresh() }} />
      )}
    </div>
  )
}

function NewFollowupModal({ userId, onClose, onSaved }: { userId?: string; onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [suggestions, setSuggestions] = useState<Customer[]>([])
  const [reason, setReason] = useState('Ask customer about product experience')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('whatsapp')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (query.length < 3 || customer) { setSuggestions([]); return }
    const handle = setTimeout(() => searchCustomers(query, 5).then(setSuggestions), 250)
    return () => clearTimeout(handle)
  }, [query, customer])

  async function handleSave() {
    if (!customer || !reason || !date) return
    setSaving(true)
    try {
      await createFollowup({ customer_id: customer.id, reason, followup_date: date, contact_method: method as Followup['contact_method'], notes, created_by: userId, status: 'pending' })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Schedule Follow-up" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Customer</Label>
          {customer ? (
            <div className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
              <span className="text-sm font-medium text-ink-800">{customer.name} · {customer.phone}</span>
              <button onClick={() => setCustomer(null)} className="text-xs text-brand-600">Change</button>
            </div>
          ) : (
            <>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or phone" />
              {suggestions.length > 0 && (
                <div className="mt-1.5 divide-y divide-ink-50 rounded-xl border border-ink-100">
                  {suggestions.map((c) => (
                    <button key={c.id} onClick={() => { setCustomer(c); setQuery('') }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-ink-50">
                      {c.name} <span className="text-xs text-ink-400">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <Label>Reason</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option>Ask customer about product experience</option>
            <option>Request Google review</option>
            <option>Check repeat purchase</option>
            <option>Follow up after 21 days</option>
            <option>Customer reported issue</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Follow-up Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label>Contact Method</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="whatsapp">WhatsApp</option><option value="call">Call</option><option value="sms">SMS</option><option value="email">Email</option><option value="other">Other</option>
            </Select>
          </div>
        </div>
        <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <Button className="w-full" onClick={handleSave} disabled={saving || !customer}>{saving ? 'Saving…' : 'Schedule Follow-up'}</Button>
      </div>
    </Modal>
  )
}
