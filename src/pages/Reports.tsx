import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { PageHeader, Card, Button, Input, Select, Label } from '../components/ui/primitives'
import { listOrders } from '../services/orders'
import { listCustomers } from '../services/customers'
import { listFeedback } from '../services/feedback'
import { getProductPerformance, getEventComparison } from '../services/analytics'
import { listEvents } from '../services/events'
import { exportToCsv } from '../utils/exportCsv'

const REPORTS = [
  { id: 'daily_sales', label: 'Daily Sales Report', description: 'Orders, customers, units sold, revenue by day.' },
  { id: 'event_report', label: 'Event Report', description: 'Per-event revenue, orders, customers, average order value.' },
  { id: 'customer_report', label: 'Customer Report', description: 'Full customer list with contact info and status.' },
  { id: 'product_report', label: 'Product Report', description: 'Units sold, revenue, and remaining stock per product.' },
  { id: 'feedback_report', label: 'Feedback Report', description: 'All feedback with ratings and follow-up status.' },
]

export function Reports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function runReport(id: string) {
    setBusy(id)
    try {
      if (id === 'daily_sales') {
        const { data } = await listOrders({ page: 0, pageSize: 5000, fromDate: from || undefined, toDate: to || undefined, eventId: eventFilter || undefined })
        const byDay = new Map<string, { orders: number; customers: Set<string>; units: number; revenue: number }>()
        for (const o of data) {
          const day = o.order_date.slice(0, 10)
          const entry = byDay.get(day) ?? { orders: 0, customers: new Set<string>(), units: 0, revenue: 0 }
          entry.orders += 1
          entry.customers.add(o.customer_id)
          entry.units += (o.order_items ?? []).reduce((s, i) => s + i.quantity, 0)
          entry.revenue += Number(o.total_amount)
          byDay.set(day, entry)
        }
        exportToCsv('daily_sales_report', Array.from(byDay.entries()).map(([date, v]) => ({
          date, orders: v.orders, customers: v.customers.size, units_sold: v.units, revenue: v.revenue,
        })))
      }

      if (id === 'event_report') {
        const events = await getEventComparison()
        exportToCsv('event_report', events.map((e) => ({
          event: e.name, orders: e.orders, customers: e.customers, revenue: e.revenue, avg_order_value: e.avgOrderValue.toFixed(2),
        })))
      }

      if (id === 'customer_report') {
        const { data } = await listCustomers({ page: 0, pageSize: 5000 })
        exportToCsv('customer_report', data.map((c) => ({
          customer_code: c.customer_code, name: c.name, phone: c.phone, email: c.email, city: c.city,
          status: c.status, communication_consent: c.communication_consent, created_at: c.created_at,
        })))
      }

      if (id === 'product_report') {
        const products = await getProductPerformance()
        exportToCsv('product_report', products.map((p) => ({ product: p.name, units_sold: p.quantity, revenue: p.revenue })))
      }

      if (id === 'feedback_report') {
        const feedback = await listFeedback()
        exportToCsv('feedback_report', feedback.map((f) => ({
          customer: f.customer?.name, product: f.product?.name, rating: f.rating, type: f.feedback_type,
          review: f.review, status: f.status, date: f.created_at,
        })))
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Generate and download business reports for any date range." />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Event (optional, applies to Daily Sales)</Label>
            <EventSelect value={eventFilter} onChange={setEventFilter} />
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-400">Date range applies to the Daily Sales Report. Other reports export current full data.</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.id} className="flex items-center justify-between p-5">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 text-brand-500" />
              <div>
                <p className="font-medium text-ink-800">{r.label}</p>
                <p className="text-xs text-ink-400">{r.description}</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => runReport(r.id)} disabled={busy === r.id}>
              <Download className="h-3.5 w-3.5" /> {busy === r.id ? 'Exporting…' : 'CSV'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}

function EventSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  useEffect(() => { listEvents().then((e) => setEvents(e.map((ev) => ({ id: ev.id, name: ev.name })))) }, [])
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-[180px]">
      <option value="">All Events</option>
      {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
    </Select>
  )
}
