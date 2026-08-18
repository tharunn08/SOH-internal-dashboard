import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { IndianRupee, ShoppingBag, Users, Package, Star, TrendingUp, AlertTriangle, PhoneCall } from 'lucide-react'
import { Card, PageHeader, Button, Spinner } from '../components/ui/primitives'
import { getDashboardKpis, getRevenueOverTime, type DashboardKpis } from '../services/analytics'
import { listProducts, lowStockProducts } from '../services/products'
import { listFollowups } from '../services/feedback'
import { formatCurrency, formatDate } from '../utils/format'
import type { Product } from '../types/domain'
import type { Followup } from '../types/domain'

export function Dashboard() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [revenue, setRevenue] = useState<{ date: string; revenue: number }[]>([])
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [todayFollowups, setTodayFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [k, r, products, followups] = await Promise.all([
          getDashboardKpis(),
          getRevenueOverTime(14),
          listProducts(),
          listFollowups({ onlyToday: true }),
        ])
        if (!mounted) return
        setKpis(k)
        setRevenue(r)
        setLowStock(lowStockProducts(products))
        setTodayFollowups(followups.filter((f) => f.status === 'pending'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const cards = [
    { label: "Today's Sales", value: formatCurrency(kpis?.todaySales ?? 0), icon: IndianRupee },
    { label: 'Total Revenue', value: formatCurrency(kpis?.totalRevenue ?? 0), icon: TrendingUp },
    { label: 'Total Orders', value: kpis?.totalOrders ?? 0, icon: ShoppingBag },
    { label: 'Total Customers', value: kpis?.totalCustomers ?? 0, icon: Users },
    { label: 'Products Sold', value: kpis?.productsSold ?? 0, icon: Package },
    { label: 'Avg Order Value', value: formatCurrency(kpis?.averageOrderValue ?? 0), icon: IndianRupee },
    { label: 'New Customers Today', value: kpis?.newCustomersToday ?? 0, icon: Users },
    { label: 'Avg Rating', value: (kpis?.averageRating ?? 0).toFixed(1) + ' ★', icon: Star },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live overview of Sake of Health's offline sales and customer activity."
        actions={
          <Link to="/orders/new">
            <Button size="lg">+ New Order</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-ink-400">{c.label}</p>
              <c.icon className="h-4 w-4 text-brand-500" />
            </div>
            <p className="font-display text-2xl font-semibold text-ink-900">{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="mb-4 font-display text-base font-semibold text-ink-800">Revenue — last 14 days</p>
          {revenue.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-400">No sales recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e2" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => formatDate(d, { year: undefined })} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={(d) => formatDate(String(d))} />
                <Line type="monotone" dataKey="revenue" stroke="#b6632a" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="font-display text-sm font-semibold text-ink-800">Low Stock</p>
            </div>
            {lowStock.length === 0 ? (
              <p className="text-sm text-ink-400">All products are well stocked.</p>
            ) : (
              <ul className="space-y-2">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-700">{p.name}</span>
                    <span className="font-semibold text-red-600">{p.stock_quantity} left</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-brand-500" />
              <p className="font-display text-sm font-semibold text-ink-800">Today's Follow-ups</p>
            </div>
            {todayFollowups.length === 0 ? (
              <p className="text-sm text-ink-400">No follow-ups scheduled for today.</p>
            ) : (
              <ul className="space-y-2">
                {todayFollowups.map((f) => (
                  <li key={f.id} className="text-sm">
                    <p className="font-medium text-ink-700">{f.customer?.name}</p>
                    <p className="text-xs text-ink-400">{f.reason}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/followups" className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline">
              View all follow-ups →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
