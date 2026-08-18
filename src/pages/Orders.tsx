import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { PageHeader, Button, Card, Select, Badge, EmptyState, Spinner, Input } from '../components/ui/primitives'
import { listOrders } from '../services/orders'
import { listEvents } from '../services/events'
import type { Order, Event } from '../types/domain'
import { formatCurrency, formatDate } from '../utils/format'
import { exportToCsv } from '../utils/exportCsv'

const PAGE_SIZE = 25

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [eventId, setEventId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { listEvents().then(setEvents) }, [])

  useEffect(() => {
    setLoading(true)
    listOrders({ page, pageSize: PAGE_SIZE, eventId: eventId || undefined, paymentMethod: paymentMethod || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined })
      .then(({ data, count }) => { setOrders(data); setCount(count) })
      .finally(() => setLoading(false))
  }, [page, eventId, paymentMethod, fromDate, toDate])

  async function handleExport() {
    const { data } = await listOrders({ page: 0, pageSize: 5000, eventId: eventId || undefined, paymentMethod: paymentMethod || undefined })
    exportToCsv('sake_of_health_orders', data.map((o) => ({
      order_code: o.order_code,
      date: o.order_date,
      customer: o.customer?.name,
      phone: o.customer?.phone,
      event: o.event?.name,
      products: o.order_items?.map((i) => `${i.product?.name} x${i.quantity}`).join('; '),
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total_amount,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
    })))
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="All offline event orders."
        actions={
          <>
            <Button variant="secondary" onClick={handleExport}><Download className="h-4 w-4" /> Export CSV</Button>
            <Link to="/orders/new"><Button>+ New Order</Button></Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={eventId} onChange={(e) => { setPage(0); setEventId(e.target.value) }} className="max-w-[200px]">
          <option value="">All Events</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
        <Select value={paymentMethod} onChange={(e) => { setPage(0); setPaymentMethod(e.target.value) }} className="max-w-[160px]">
          <option value="">All Payment Methods</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => { setPage(0); setFromDate(e.target.value) }} className="max-w-[160px]" />
        <Input type="date" value={toDate} onChange={(e) => { setPage(0); setToDate(e.target.value) }} className="max-w-[160px]" />
        {(eventId || paymentMethod || fromDate || toDate) && (
          <Button variant="ghost" onClick={() => { setEventId(''); setPaymentMethod(''); setFromDate(''); setToDate('') }}>Clear Filters</Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center"><Spinner /></div>
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet" description="Record your first offline sale to see it here." action={<Link to="/orders/new"><Button>+ New Order</Button></Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase text-ink-400">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="cursor-pointer border-b border-ink-50 hover:bg-ink-50" onClick={() => navigate(`/orders/${o.id}`)}>
                    <td className="px-4 py-3 font-medium text-ink-700">{o.order_code}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(o.order_date)}</td>
                    <td className="px-4 py-3 text-ink-700">{o.customer?.name}</td>
                    <td className="px-4 py-3 text-ink-500">{o.event?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-ink-700">{formatCurrency(o.total_amount)}</td>
                    <td className="px-4 py-3"><Badge status={o.payment_status}>{o.payment_method}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {count > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
          <span>{page * PAGE_SIZE + 1}–{Math.min(count, (page + 1) * PAGE_SIZE)} of {count}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
