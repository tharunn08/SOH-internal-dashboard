import { supabase } from '../lib/supabase'
import type { Product } from '../types/domain'

export async function listProducts(opts: { includeInactive?: boolean } = {}) {
  let req = supabase.from('products').select('*').order('name', { ascending: true })
  if (!opts.includeInactive) req = req.eq('status', 'active')
  const { data, error } = await req
  if (error) throw error
  return data as Product[]
}

export async function getProduct(id: string) {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
  if (error) throw error
  return data as Product
}

export async function createProduct(input: Partial<Product>) {
  const { data, error } = await supabase.from('products').insert(input).select('*').single()
  if (error) throw error
  return data as Product
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const { data, error } = await supabase.from('products').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Product
}

export async function archiveProduct(id: string) {
  return updateProduct(id, { status: 'archived' })
}

export async function adjustInventory(
  productId: string,
  transactionType: 'restock' | 'adjustment' | 'damaged' | 'returned',
  quantity: number,
  notes: string,
  userId?: string | null
) {
  const { data, error } = await supabase.rpc('adjust_inventory', {
    p_product_id: productId,
    p_transaction_type: transactionType,
    p_quantity: quantity,
    p_notes: notes,
    p_created_by: userId ?? null,
  })
  if (error) throw error
  return data as Product
}

export async function listInventoryTransactions(productId?: string) {
  let req = supabase
    .from('inventory_transactions')
    .select('*, product:products(*)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (productId) req = req.eq('product_id', productId)
  const { data, error } = await req
  if (error) throw error
  return data
}

export function lowStockProducts(products: Product[]) {
  return products.filter((p) => p.status === 'active' && p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock)
}

export function outOfStockProducts(products: Product[]) {
  return products.filter((p) => p.status === 'active' && p.stock_quantity <= 0)
}

export function inStockProducts(products: Product[]) {
  return products.filter((p) => p.status === 'active' && p.stock_quantity > p.minimum_stock)
}
