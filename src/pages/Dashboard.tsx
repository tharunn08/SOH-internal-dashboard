import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { UserPlus, Boxes, Package, PackageCheck, PackageX, AlertTriangle, PhoneCall, ChevronRight } from 'lucide-react'
import { Card, PageHeader, Button, Spinner } from '../components/ui/primitives'
import { getDashboardKpis, getRevenueOverTime, type DashboardKpis } from '../services/analytics'
import { listProducts, lowStockProducts, outOfStockProducts, inStockProducts } from '../services/products'
import { listFollowups } from '../services/feedback'
import { formatCurrency, formatDate } from '../utils/format'
import type { Product } from '../types/domain'
import type { Followup } from '../types/domain'

export function Dashboard() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [revenue, setRevenue] = useState<{ date: string; revenue: number }[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [todayFollowups, setTodayFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [k, r, p, followups] = await Promise.all([
          getDashboardKpis(),
          getRevenueOverTime(14),
          listProducts({ includeInactive: true }),
          listFollowups({ onlyToday: true }),
        ])
        if (!mounted) return
        setKpis(k)
        setRevenue(r)
        setProducts(p)
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

  const lowStock = lowStockProducts(products)
  const outOfStock = outOfStockProducts(products)
  const inStock = inStockProducts(products)

  // Each tile links to the page that has the full detail behind that number —
  // clicking a tile takes you straight to the filtered list, not just a count.
  const navCards = [
    {
      label: 'New Customers',
      value: kpis?.newCustomersToday ?? 0,
      sub: 'today · view all',
      icon: UserPlus,
      to: '/customers?status=new',
    },
    {
      label: 'Products',
      value: products.filter((p) => p.status === 'active').length,
      sub: 'active in catalog',
      icon: Package,
      to: '/products',
    },
    {
      label: 'Inventory',
      value: products.length,
      sub: 'tracked SKUs',
      icon: Boxes,
      to: '/inventory',
    },
    {
      label: 'In Stock',
      value: inStock.length,
      sub: 'above minimum level',
      icon: PackageCheck,
      to: '/inventory/in-stock',
    },
    {
      label: 'Out of Stock',
      value: outOfStock.length,
      sub: outOfStock.length ? 'needs restock now' : 'all clear',
      icon: PackageX,
      to: '/inventory/out-of-stock',
      urgent: outOfStock.length > 0,
    },
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {navCards.map((c) => (
          <Card
            key={c.label}
            className={`cursor-pointer p-4 transition-shadow hover:shadow-md ${c.urgent ? 'border-red-200 bg-red-50' : ''}`}
            onClick={() => navigate(c.to)}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className={`text-xs font-medium ${c.urgent ? 'text-red-500' : 'text-ink-400'}`}>{c.label}</p>
              <c.icon className={`h-4 w-4 ${c.urgent ? 'text-red-500' : 'text-brand-500'}`} />
            </div>
            <p className={`font-display text-2xl font-semibold ${c.urgent ? 'text-red-700' : 'text-ink-900'}`}>{c.value}</p>
            <p className={`mt-1 flex items-center gap-0.5 text-[11px] ${c.urgent ? 'text-red-500' : 'text-ink-400'}`}>
              {c.sub} <ChevronRight className="h-3 w-3" />
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link to="/orders">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-400">Total Orders</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink-900">{kpis?.totalOrders ?? 0}</p>
          </Card>
        </Link>
        <Link to="/customers">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-400">Total Customers</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink-900">{kpis?.totalCustomers ?? 0}</p>
          </Card>
        </Link>
        <Link to="/analytics">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-400">Total Revenue</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink-900">{formatCurrency(kpis?.totalRevenue ?? 0)}</p>
          </Card>
        </Link>
        <Link to="/reports">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-400">Avg Order Value</p>
            <p className="mt-1 font-display text-xl font-semibold text-ink-900">{formatCurrency(kpis?.averageOrderValue ?? 0)}</p>
          </Card>
        </Link>
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
            <Link to="/inventory/low-stock" className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline">
              View inventory →
            </Link>
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
