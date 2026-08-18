import { supabase } from '../lib/supabase'

export interface DashboardKpis {
  todaySales: number
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  productsSold: number
  averageOrderValue: number
  newCustomersToday: number
  feedbackCollected: number
  averageRating: number
}

const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const todayIso = startOfToday()

  const [ordersRes, todayOrdersRes, customersRes, newCustomersRes, itemsRes, feedbackRes] = await Promise.all([
    supabase.from('orders').select('total_amount', { count: 'exact' }).eq('order_status', 'completed'),
    supabase.from('orders').select('total_amount').eq('order_status', 'completed').gte('order_date', todayIso),
    supabase.from('customers').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('customers').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', todayIso),
    supabase.from('order_items').select('quantity'),
    supabase.from('feedback').select('rating'),
  ])

  if (ordersRes.error) throw ordersRes.error
  if (todayOrdersRes.error) throw todayOrdersRes.error
  if (customersRes.error) throw customersRes.error
  if (newCustomersRes.error) throw newCustomersRes.error
  if (itemsRes.error) throw itemsRes.error
  if (feedbackRes.error) throw feedbackRes.error

  const totalRevenue = (ordersRes.data ?? []).reduce((s, o) => s + Number(o.total_amount), 0)
  const totalOrders = ordersRes.count ?? 0
  const todaySales = (todayOrdersRes.data ?? []).reduce((s, o) => s + Number(o.total_amount), 0)
  const productsSold = (itemsRes.data ?? []).reduce((s, i) => s + Number(i.quantity), 0)
  const ratings = (feedbackRes.data ?? []).map((f) => f.rating)
  const averageRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

  return {
    todaySales,
    totalRevenue,
    totalOrders,
    totalCustomers: customersRes.count ?? 0,
    productsSold,
    averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
    newCustomersToday: newCustomersRes.count ?? 0,
    feedbackCollected: ratings.length,
    averageRating,
  }
}

export async function getRevenueOverTime(days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('orders')
    .select('order_date, total_amount')
    .eq('order_status', 'completed')
    .gte('order_date', since.toISOString())
    .order('order_date', { ascending: true })
  if (error) throw error

  const byDay = new Map<string, { revenue: number; orders: number }>()
  for (const o of data ?? []) {
    const day = o.order_date.slice(0, 10)
    const entry = byDay.get(day) ?? { revenue: 0, orders: 0 }
    entry.revenue += Number(o.total_amount)
    entry.orders += 1
    byDay.set(day, entry)
  }
  return Array.from(byDay.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getProductPerformance() {
  const { data, error } = await supabase
    .from('order_items')
    .select('quantity, total_price, product:products(id, name, category)')
  if (error) throw error

  const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const item of data ?? []) {
    const p = item.product as unknown as { id: string; name: string } | null
    if (!p) continue
    const entry = byProduct.get(p.id) ?? { name: p.name, quantity: 0, revenue: 0 }
    entry.quantity += Number(item.quantity)
    entry.revenue += Number(item.total_price)
    byProduct.set(p.id, entry)
  }
  return Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue)
}

export async function getPaymentMethodBreakdown() {
  const { data, error } = await supabase.from('orders').select('payment_method, total_amount').eq('order_status', 'completed')
  if (error) throw error
  const byMethod = new Map<string, number>()
  for (const o of data ?? []) {
    byMethod.set(o.payment_method, (byMethod.get(o.payment_method) ?? 0) + Number(o.total_amount))
  }
  return Array.from(byMethod.entries()).map(([method, amount]) => ({ method, amount }))
}

export async function getEventComparison() {
  const { data, error } = await supabase
    .from('orders')
    .select('event_id, total_amount, customer_id, event:events(name)')
    .eq('order_status', 'completed')
    .not('event_id', 'is', null)
  if (error) throw error

  const byEvent = new Map<string, { name: string; orders: number; revenue: number; customers: Set<string> }>()
  for (const o of data ?? []) {
    if (!o.event_id) continue
    const eventName = (o.event as unknown as { name: string } | null)?.name ?? 'Unknown'
    const entry = byEvent.get(o.event_id) ?? { name: eventName, orders: 0, revenue: 0, customers: new Set<string>() }
    entry.orders += 1
    entry.revenue += Number(o.total_amount)
    entry.customers.add(o.customer_id)
    byEvent.set(o.event_id, entry)
  }
  return Array.from(byEvent.values()).map((e) => ({
    name: e.name,
    orders: e.orders,
    revenue: e.revenue,
    customers: e.customers.size,
    avgOrderValue: e.orders ? e.revenue / e.orders : 0,
  }))
}

export async function getTopCustomers(limit = 10) {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_id, total_amount, customer:customers(name, phone, customer_code)')
    .eq('order_status', 'completed')
  if (error) throw error

  const byCustomer = new Map<string, { name: string; phone: string; code: string; totalSpent: number; orders: number }>()
  for (const o of data ?? []) {
    const c = o.customer as unknown as { name: string; phone: string; customer_code: string } | null
    if (!c) continue
    const entry = byCustomer.get(o.customer_id) ?? { name: c.name, phone: c.phone, code: c.customer_code, totalSpent: 0, orders: 0 }
    entry.totalSpent += Number(o.total_amount)
    entry.orders += 1
    byCustomer.set(o.customer_id, entry)
  }
  return Array.from(byCustomer.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit)
}
