import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MessageCircle, Archive, ArrowLeft, ShoppingBag } from 'lucide-react'
import { Card, PageHeader, Button, Badge, Spinner } from '../components/ui/primitives'
import { getCustomer, getCustomerPurchaseSummary, archiveCustomer } from '../services/customers'
import { supabase } from '../lib/supabase'
import type { Customer, Order, Feedback, Followup } from '../types/domain'
import { formatCurrency, formatDate } from '../utils/format'
import { buildWhatsAppLink, MESSAGE_TEMPLATES } from '../services/feedback'
import { ConfirmDialog } from '../components/common/Modal'
import { useAuth } from '../hooks/useAuth'

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [summary, setSummary] = useState({ totalOrders: 0, totalSpent: 0, averageOrderValue: 0, firstPurchase: null as string | null, lastPurchase: null as string | null })
  const [orders, setOrders] = useState<Order[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchive, setShowArchive] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [c, s, ordersRes, feedbackRes, followupsRes] = await Promise.all([
      getCustomer(id),
      getCustomerPurchaseSummary(id),
      supabase.from('orders').select('*, order_items(*, product:products(*)), event:events(*)').eq('customer_id', id).order('order_date', { ascending: false }),
      supabase.from('feedback').select('*, product:products(*)').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('followups').select('*').eq('customer_id', id).order('followup_date', { ascending: false }),
    ])
    setCustomer(c)
    setSummary(s)
    setOrders((ordersRes.data ?? []) as unknown as Order[])
    setFeedback((feedbackRes.data ?? []) as unknown as Feedback[])
    setFollowups((followupsRes.data ?? []) as unknown as Followup[])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleArchive() {
    if (!id) return
    await archiveCustomer(id, profile?.id)
    setShowArchive(false)
    navigate('/customers')
  }

  if (loading || !customer) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  }

  const waLink = buildWhatsAppLink(customer.phone, MESSAGE_TEMPLATES.feedback(customer.name, 'Sake of Health product'))

  return (
    <div>
      <Link to="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      <PageHeader
        title={customer.name}
        description={`${customer.customer_code} · Added ${formatDate(customer.created_at)}`}
        actions={
          <>
            <a href={waLink} target="_blank" rel="noreferrer">
              <Button variant="secondary"><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
            </a>
            <Link to={`/orders/new?customer=${customer.id}`}>
              <Button><ShoppingBag className="h-4 w-4" /> New Order</Button>
            </Link>
            {isAdmin && (
              <Button variant="ghost" onClick={() => setShowArchive(true)}><Archive className="h-4 w-4" /> Archive</Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Profile</p>
          <dl className="space-y-2 text-sm">
            <Row label="Status"><Badge status={customer.status} /></Row>
            <Row label="Phone">{customer.phone}</Row>
            <Row label="Email">{customer.email ?? '—'}</Row>
            <Row label="City">{customer.city ?? '—'}</Row>
            <Row label="Age Group">{customer.age_group ?? '—'}</Row>
            <Row label="Gender">{customer.gender ?? '—'}</Row>
            <Row label="Consent">{customer.communication_consent ? 'Yes' : 'No'}</Row>
          </dl>
          {customer.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {customer.tags.map((t) => (
                <span key={t} className="rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-600">{t}</span>
              ))}
            </div>
          )}
          {customer.notes && <p className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">{customer.notes}</p>}
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Purchase Summary</p>
          <dl className="space-y-2 text-sm">
            <Row label="Total Orders">{summary.totalOrders}</Row>
            <Row label="Total Spent"><strong>{formatCurrency(summary.totalSpent)}</strong></Row>
            <Row label="Avg Order Value">{formatCurrency(summary.averageOrderValue)}</Row>
            <Row label="First Purchase">{formatDate(summary.firstPurchase)}</Row>
            <Row label="Last Purchase">{formatDate(summary.lastPurchase)}</Row>
          </dl>
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Feedback</p>
          {feedback.length === 0 ? (
            <p className="text-sm text-ink-400">No feedback collected yet.</p>
          ) : (
            <ul className="space-y-3">
              {feedback.slice(0, 3).map((f) => (
                <li key={f.id} className="text-sm">
                  <p className="text-amber-500">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</p>
                  {f.review && <p className="text-ink-600">{f.review}</p>}
                  <p className="text-xs text-ink-400">{formatDate(f.created_at)}{f.product ? ` · ${f.product.name}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <p className="mb-3 font-display text-sm font-semibold text-ink-800">Purchase History</p>
        {orders.length === 0 ? (
          <p className="text-sm text-ink-400">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase text-ink-400">
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Products</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Payment</th>
                  <th className="py-2 pr-4">Event</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="cursor-pointer border-b border-ink-50 hover:bg-ink-50" onClick={() => navigate(`/orders/${o.id}`)}>
                    <td className="py-2.5 pr-4 font-medium text-ink-700">{o.order_code}</td>
                    <td className="py-2.5 pr-4 text-ink-500">{formatDate(o.order_date)}</td>
                    <td className="py-2.5 pr-4 text-ink-500">{o.order_items?.map((i) => i.product?.name).join(', ')}</td>
                    <td className="py-2.5 pr-4 font-medium text-ink-700">{formatCurrency(o.total_amount)}</td>
                    <td className="py-2.5 pr-4"><Badge status={o.payment_status}>{o.payment_method}</Badge></td>
                    <td className="py-2.5 pr-4 text-ink-500">{o.event?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <p className="mb-3 font-display text-sm font-semibold text-ink-800">Follow-ups</p>
        {followups.length === 0 ? (
          <p className="text-sm text-ink-400">No follow-ups scheduled.</p>
        ) : (
          <ul className="divide-y divide-ink-50">
            {followups.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="text-ink-700">{f.reason}</p>
                  <p className="text-xs text-ink-400">{formatDate(f.followup_date)} · {f.contact_method}</p>
                </div>
                <Badge status={f.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showArchive && (
        <ConfirmDialog
          title="Archive customer?"
          message={`${customer.name} will be moved to archived records. This does not delete their order history, and an admin can restore them later.`}
          confirmLabel="Archive Customer"
          danger
          onConfirm={handleArchive}
          onClose={() => setShowArchive(false)}
        />
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-ink-700">{children}</dd>
    </div>
  )
}
