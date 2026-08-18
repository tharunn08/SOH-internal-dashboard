import { supabase } from '../lib/supabase'
import type { Customer } from '../types/domain'

export async function findCustomerByPhone(phone: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone.trim())
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data as Customer | null
}

export async function searchCustomers(query: string, limit = 20) {
  const q = query.trim()
  let req = supabase.from('customers').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(limit)
  if (q) {
    req = req.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,customer_code.ilike.%${q}%`)
  }
  const { data, error } = await req
  if (error) throw error
  return data as Customer[]
}

export async function listCustomers(opts: {
  page?: number
  pageSize?: number
  status?: string
  search?: string
} = {}) {
  const { page = 0, pageSize = 25, status, search } = opts
  let req = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (status) req = req.eq('status', status)
  if (search) req = req.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error, count } = await req
  if (error) throw error
  return { data: data as Customer[], count: count ?? 0 }
}

export async function getCustomer(id: string) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single()
  if (error) throw error
  return data as Customer
}

export interface NewCustomerInput {
  name: string
  phone: string
  email?: string
  city?: string
  age_group?: string
  gender?: string
  preferred_product_id?: string
  heard_from?: string
  communication_consent?: boolean
  notes?: string
  created_by?: string
}

export async function createCustomer(input: NewCustomerInput) {
  const { data, error } = await supabase.from('customers').insert(input).select('*').single()
  if (error) throw error
  await logAudit(input.created_by ?? null, 'created', 'customer', data.id, `Customer ${data.customer_code} (${data.name}) created`)
  return data as Customer
}

export async function updateCustomer(id: string, patch: Partial<Customer>, userId?: string | null) {
  const { data, error } = await supabase.from('customers').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  await logAudit(userId ?? null, 'updated', 'customer', id, `Customer ${data.customer_code} updated`)
  return data as Customer
}

export async function archiveCustomer(id: string, userId?: string | null) {
  const { data, error } = await supabase
    .from('customers')
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  await logAudit(userId ?? null, 'archived', 'customer', id, `Customer ${data.customer_code} archived`)
  return data as Customer
}

export async function restoreCustomer(id: string, userId?: string | null) {
  const { data, error } = await supabase
    .from('customers')
    .update({ active: true, deleted_at: null })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  await logAudit(userId ?? null, 'restored', 'customer', id, `Customer ${data.customer_code} restored`)
  return data as Customer
}

export async function permanentlyDeleteCustomer(id: string, userId?: string | null) {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
  await logAudit(userId ?? null, 'deleted', 'customer', id, `Customer permanently deleted`)
}

export async function getCustomerPurchaseSummary(customerId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, total_amount, order_date')
    .eq('customer_id', customerId)
    .eq('order_status', 'completed')
    .order('order_date', { ascending: true })
  if (error) throw error
  const orders = data ?? []
  const totalSpent = orders.reduce((s, o) => s + Number(o.total_amount), 0)
  return {
    totalOrders: orders.length,
    totalSpent,
    averageOrderValue: orders.length ? totalSpent / orders.length : 0,
    firstPurchase: orders[0]?.order_date ?? null,
    lastPurchase: orders[orders.length - 1]?.order_date ?? null,
  }
}

async function logAudit(userId: string | null, action: string, entityType: string, entityId: string, description: string) {
  await supabase.from('audit_logs').insert({ user_id: userId, action, entity_type: entityType, entity_id: entityId, description })
}
