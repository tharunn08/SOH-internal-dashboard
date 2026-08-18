import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, Badge, Spinner, EmptyState, Input, Label, Textarea } from '../components/ui/primitives'
import { listEvents, createEvent } from '../services/events'
import type { Event } from '../types/domain'
import { formatDate } from '../utils/format'
import { Modal } from '../components/common/Modal'

export function Events() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()

  async function refresh() {
    setLoading(true)
    setEvents(await listEvents())
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  return (
    <div>
      <PageHeader title="Events" description="Stalls, expos, and pop-ups where Sake of Health sells offline." actions={<Button onClick={() => setShowNew(true)}>+ Add Event</Button>} />

      {loading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : events.length === 0 ? (
        <EmptyState title="No events yet" description="Create your first event to start tracking offline sales by location." action={<Button onClick={() => setShowNew(true)}>+ Add Event</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Card key={e.id} className="cursor-pointer p-5 hover:border-brand-300" onClick={() => navigate(`/events/${e.id}`)}>
              <div className="mb-2 flex items-start justify-between">
                <p className="font-display font-semibold text-ink-900">{e.name}</p>
                <Badge status={e.status} />
              </div>
              <p className="text-sm text-ink-500">{e.location}</p>
              <p className="mt-1 text-xs text-ink-400">{formatDate(e.start_date)}{e.end_date ? ` – ${formatDate(e.end_date)}` : ''}</p>
              <p className="mt-2 text-xs text-ink-300">{e.event_code}</p>
            </Card>
          ))}
        </div>
      )}

      {showNew && <NewEventModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); refresh() }} />}
    </div>
  )
}

function NewEventModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', location: '', start_date: '', end_date: '', organizer: '', stall_number: '', budget: 0, notes: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name || !form.start_date) return
    setSaving(true)
    try {
      await createEvent({ ...form, status: 'upcoming' })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Event" onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <Label>Event Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Health & Wellness Expo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div><Label>Stall Number</Label><Input value={form.stall_number} onChange={(e) => setForm({ ...form, stall_number: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Organizer</Label><Input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} /></div>
          <div><Label>Budget (₹)</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Create Event'}</Button>
      </div>
    </Modal>
  )
}
