import { supabase } from '../lib/supabase'
import type { Event } from '../types/domain'

export async function listEvents() {
  const { data, error } = await supabase.from('events').select('*').order('start_date', { ascending: false })
  if (error) throw error
  return data as Event[]
}

export async function getEvent(id: string) {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single()
  if (error) throw error
  return data as Event
}

export async function createEvent(input: Partial<Event>) {
  const { data, error } = await supabase.from('events').insert(input).select('*').single()
  if (error) throw error
  return data as Event
}

export async function updateEvent(id: string, patch: Partial<Event>) {
  const { data, error } = await supabase.from('events').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Event
}

export async function getEventPerformance(eventId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, total_amount, customer_id, payment_method, order_items(quantity)')
    .eq('event_id', eventId)
    .eq('order_status', 'completed')
  if (error) throw error
  const orders = data ?? []
  const revenue = orders.reduce((s, o) => s + Number(o.total_amount), 0)
  const uniqueCustomers = new Set(orders.map((o) => o.customer_id)).size
  const unitsSold = orders.reduce(
    (s, o) => s + (o.order_items ?? []).reduce((si: number, it: { quantity: number }) => si + it.quantity, 0),
    0
  )
  return {
    totalOrders: orders.length,
    totalRevenue: revenue,
    uniqueCustomers,
    unitsSold,
    averageOrderValue: orders.length ? revenue / orders.length : 0,
  }
}
