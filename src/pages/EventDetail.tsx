import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, PageHeader, Spinner, Select } from '../components/ui/primitives'
import { getEvent, getEventPerformance, updateEvent } from '../services/events'
import type { Event, EventStatus } from '../types/domain'
import { formatCurrency, formatDate } from '../utils/format'

export function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [perf, setPerf] = useState({ totalOrders: 0, totalRevenue: 0, uniqueCustomers: 0, unitsSold: 0, averageOrderValue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getEvent(id), getEventPerformance(id)]).then(([e, p]) => { setEvent(e); setPerf(p) }).finally(() => setLoading(false))
  }, [id])

  async function handleStatusChange(status: EventStatus) {
    if (!id || !event) return
    const updated = await updateEvent(id, { status })
    setEvent(updated)
  }

  if (loading || !event) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  return (
    <div>
      <Link to="/events" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>
      <PageHeader title={event.name} description={`${event.event_code} · ${event.location ?? ''}`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-ink-400">Total Revenue</p><p className="font-display text-xl font-semibold text-ink-900">{formatCurrency(perf.totalRevenue)}</p></Card>
        <Card className="p-4"><p className="text-xs text-ink-400">Orders</p><p className="font-display text-xl font-semibold text-ink-900">{perf.totalOrders}</p></Card>
        <Card className="p-4"><p className="text-xs text-ink-400">Unique Customers</p><p className="font-display text-xl font-semibold text-ink-900">{perf.uniqueCustomers}</p></Card>
        <Card className="p-4"><p className="text-xs text-ink-400">Units Sold</p><p className="font-display text-xl font-semibold text-ink-900">{perf.unitsSold}</p></Card>
      </div>

      <Card className="mt-6 p-5">
        <p className="mb-3 font-display text-sm font-semibold text-ink-800">Event Details</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Status"><Select value={event.status} onChange={(e) => handleStatusChange(e.target.value as EventStatus)} className="w-40">
            <option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </Select></Row>
          <Row label="Dates">{formatDate(event.start_date)}{event.end_date ? ` – ${formatDate(event.end_date)}` : ''}</Row>
          <Row label="Organizer">{event.organizer ?? '—'}</Row>
          <Row label="Stall Number">{event.stall_number ?? '—'}</Row>
          <Row label="Budget">{event.budget ? formatCurrency(event.budget) : '—'}</Row>
          <Row label="Avg Order Value">{formatCurrency(perf.averageOrderValue)}</Row>
        </dl>
        {event.notes && <p className="mt-4 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">{event.notes}</p>}
      </Card>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-ink-700">{children}</dd>
    </div>
  )
}
