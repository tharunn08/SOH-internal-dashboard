import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { PageHeader, Card, Spinner } from '../components/ui/primitives'
import {
  getRevenueOverTime, getProductPerformance, getPaymentMethodBreakdown, getEventComparison, getTopCustomers,
} from '../services/analytics'
import { formatCurrency } from '../utils/format'

const COLORS = ['#b6632a', '#cf7d38', '#dd9a57', '#e9bd8a', '#f3d9bb']

export function Analytics() {
  const [revenue, setRevenue] = useState<{ date: string; revenue: number; orders: number }[]>([])
  const [products, setProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([])
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([])
  const [eventsPerf, setEventsPerf] = useState<{ name: string; orders: number; revenue: number; customers: number; avgOrderValue: number }[]>([])
  const [topCustomers, setTopCustomers] = useState<{ name: string; phone: string; totalSpent: number; orders: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getRevenueOverTime(30),
      getProductPerformance(),
      getPaymentMethodBreakdown(),
      getEventComparison(),
      getTopCustomers(8),
    ]).then(([r, p, pay, ev, tc]) => {
      setRevenue(r); setProducts(p); setPayments(pay); setEventsPerf(ev); setTopCustomers(tc)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)

  return (
    <div>
      <PageHeader title="Analytics" description="Sales, products, events, and customer insights in one place." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Revenue over time (30 days)</p>
          {revenue.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e2" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="#b6632a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Orders over time (30 days)</p>
          {revenue.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e2" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="#dd9a57" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Product sales (units)</p>
          {products.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={products} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e2" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="quantity" fill="#b6632a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Revenue by product</p>
          {products.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={products} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e2" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenue" fill="#904d24" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Payment method breakdown</p>
          {payments.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={payments} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={80} label={(p) => `${p.name}: ${formatCurrency(Number(p.value))}`}>
                  {payments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-display text-sm font-semibold text-ink-800">Top Customers</p>
          {topCustomers.length === 0 ? <EmptyChart /> : (
            <ul className="space-y-2.5">
              {topCustomers.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-ink-700">{c.name}</p>
                    <p className="text-xs text-ink-400">{c.phone} · {c.orders} orders</p>
                  </div>
                  <span className="font-semibold text-brand-600">{formatCurrency(c.totalSpent)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <p className="mb-3 font-display text-sm font-semibold text-ink-800">Event Performance Comparison</p>
        {eventsPerf.length === 0 ? <EmptyChart /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase text-ink-400">
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Orders</th>
                  <th className="py-2 pr-4">Customers</th>
                  <th className="py-2 pr-4">Revenue</th>
                  <th className="py-2 pr-4">Avg Order Value</th>
                </tr>
              </thead>
              <tbody>
                {eventsPerf.sort((a, b) => b.revenue - a.revenue).map((e, i) => (
                  <tr key={i} className="border-b border-ink-50">
                    <td className="py-2.5 pr-4 font-medium text-ink-700">{e.name}</td>
                    <td className="py-2.5 pr-4 text-ink-500">{e.orders}</td>
                    <td className="py-2.5 pr-4 text-ink-500">{e.customers}</td>
                    <td className="py-2.5 pr-4 font-medium text-ink-700">{formatCurrency(e.revenue)}</td>
                    <td className="py-2.5 pr-4 text-ink-500">{formatCurrency(e.avgOrderValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-2 text-right text-xs text-ink-300">Total tracked revenue across all products: {formatCurrency(totalRevenue)}</p>
    </div>
  )
}

function EmptyChart() {
  return <p className="flex h-48 items-center justify-center text-sm text-ink-400">Not enough data yet.</p>
}
