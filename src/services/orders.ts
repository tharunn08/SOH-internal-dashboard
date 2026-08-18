import { supabase } from '../lib/supabase'
import type { Order, OrderItemInput, PaymentMethod, PaymentStatus } from '../types/domain'

export interface CreateOrderInput {
  clientTxnId: string // idempotency key generated client-side (crypto.randomUUID())
  customerId: string
  eventId: string | null
  staffId: string | null
  items: OrderItemInput[]
  discount: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  notes?: string
}

export async function createOfflineOrder(input: CreateOrderInput) {
  const { data, error } = await supabase.rpc('create_offline_order', {
    p_client_txn_id: input.clientTxnId,
    p_customer_id: input.customerId,
    p_event_id: input.eventId,
    p_staff_id: input.staffId,
    p_items: input.items,
    p_discount: input.discount,
    p_payment_method: input.paymentMethod,
    p_payment_status: input.paymentStatus,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as Order
}

export async function listOrders(opts: {
  page?: number
  pageSize?: number
  search?: string
  eventId?: string
  paymentMethod?: string
  paymentStatus?: string
  fromDate?: string
  toDate?: string
} = {}) {
  const { page = 0, pageSize = 25, search, eventId, paymentMethod, paymentStatus, fromDate, toDate } = opts
  let req = supabase
    .from('orders')
    .select('*, customer:customers(*), event:events(*), order_items(*, product:products(*))', { count: 'exact' })
    .eq('order_status', 'completed')
    .order('order_date', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (eventId) req = req.eq('event_id', eventId)
  if (paymentMethod) req = req.eq('payment_method', paymentMethod)
  if (paymentStatus) req = req.eq('payment_status', paymentStatus)
  if (fromDate) req = req.gte('order_date', fromDate)
  if (toDate) req = req.lte('order_date', toDate)
  if (search) req = req.eq('order_code', search) // combined with customer search client-side for simplicity

  const { data, error, count } = await req
  if (error) throw error
  return { data: data as unknown as Order[], count: count ?? 0 }
}

export async function getOrder(id: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customer:customers(*), event:events(*), order_items(*, product:products(*))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as Order
}

export async function archiveOrder(id: string, userId?: string | null) {
  const { data, error } = await supabase
    .from('orders')
    .update({ order_status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  await supabase.from('audit_logs').insert({
    user_id: userId ?? null,
    action: 'archived',
    entity_type: 'order',
    entity_id: id,
    description: `Order ${data.order_code} archived`,
  })
  return data as Order
}
