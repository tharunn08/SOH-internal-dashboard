export type UserRole = 'admin' | 'manager' | 'staff'
export type CustomerStatus = 'new' | 'active' | 'repeat' | 'vip' | 'inactive'
export type ProductCategory = 'multivitamin' | 'iron' | 'probiotic_prebiotic' | 'curcumin' | 'other'
export type ProductStatus = 'active' | 'inactive' | 'archived'
export type EventStatus = 'upcoming' | 'active' | 'completed' | 'cancelled'
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other'
export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'refunded'
export type OrderStatus = 'completed' | 'archived' | 'cancelled'
export type SalesChannel = 'offline_event' | 'online' | 'direct' | 'other'
export type InventoryTxnType = 'opening' | 'restock' | 'sale' | 'adjustment' | 'damaged' | 'returned'
export type FeedbackType = 'taste' | 'quality' | 'packaging' | 'price' | 'buying_experience' | 'overall_experience' | 'other'
export type FeedbackStatus = 'new' | 'reviewed' | 'follow_up_required' | 'resolved'
export type FollowupStatus = 'pending' | 'contacted' | 'completed' | 'not_interested'
export type FollowupContactMethod = 'whatsapp' | 'call' | 'sms' | 'email' | 'other'

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  customer_code: string
  name: string
  phone: string
  email: string | null
  city: string | null
  age_group: string | null
  gender: string | null
  preferred_product_id: string | null
  heard_from: string | null
  communication_consent: boolean
  status: CustomerStatus
  tags: string[]
  notes: string | null
  source: SalesChannel
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Product {
  id: string
  product_code: string
  name: string
  category: ProductCategory
  description: string | null
  image_url: string | null
  sku: string | null
  selling_price: number
  original_price: number | null
  stock_quantity: number
  minimum_stock: number
  status: ProductStatus
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  event_code: string
  name: string
  location: string | null
  start_date: string
  end_date: string | null
  organizer: string | null
  stall_number: string | null
  staff_members: string[]
  budget: number | null
  status: EventStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_code: string
  client_txn_id: string | null
  customer_id: string
  event_id: string | null
  staff_id: string | null
  order_date: string
  sales_channel: SalesChannel
  source: string
  source_order_id: string | null
  subtotal: number
  discount: number
  total_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  order_status: OrderStatus
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  // joined
  customer?: Customer
  event?: Event
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number
  total_price: number
  created_at: string
  product?: Product
}

export interface Feedback {
  id: string
  feedback_code: string
  customer_id: string
  order_id: string | null
  product_id: string | null
  rating: number
  feedback_type: FeedbackType
  review: string | null
  staff_id: string | null
  follow_up_required: boolean
  status: FeedbackStatus
  created_at: string
  updated_at: string
  customer?: Customer
  product?: Product
}

export interface Followup {
  id: string
  customer_id: string
  order_id: string | null
  product_id: string | null
  followup_date: string
  reason: string
  contact_method: FollowupContactMethod
  status: FollowupStatus
  notes: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
  customer?: Customer
}

export interface InventoryTransaction {
  id: string
  product_id: string
  transaction_type: InventoryTxnType
  quantity: number
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  product?: Product
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface OrderItemInput {
  product_id: string
  quantity: number
  unit_price: number
  discount: number
}
