import { supabase } from '../lib/supabase'
import type { Feedback, Followup } from '../types/domain'

export async function listFeedback(opts: { status?: string; search?: string } = {}) {
  let req = supabase
    .from('feedback')
    .select('*, customer:customers(*), product:products(*)')
    .order('created_at', { ascending: false })
  if (opts.status) req = req.eq('status', opts.status)
  const { data, error } = await req
  if (error) throw error
  return data as unknown as Feedback[]
}

export async function createFeedback(input: Partial<Feedback>) {
  const { data, error } = await supabase.from('feedback').insert(input).select('*').single()
  if (error) throw error
  return data as Feedback
}

export async function updateFeedback(id: string, patch: Partial<Feedback>) {
  const { data, error } = await supabase.from('feedback').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Feedback
}

export async function listFollowups(opts: { status?: string; onlyToday?: boolean } = {}) {
  let req = supabase
    .from('followups')
    .select('*, customer:customers(*)')
    .order('followup_date', { ascending: true })
  if (opts.status) req = req.eq('status', opts.status)
  if (opts.onlyToday) req = req.eq('followup_date', new Date().toISOString().slice(0, 10))
  const { data, error } = await req
  if (error) throw error
  return data as unknown as Followup[]
}

export async function createFollowup(input: Partial<Followup>) {
  const { data, error } = await supabase.from('followups').insert(input).select('*').single()
  if (error) throw error
  return data as Followup
}

export async function updateFollowup(id: string, patch: Partial<Followup>) {
  const payload = { ...patch }
  if (patch.status === 'completed') payload.completed_at = new Date().toISOString()
  const { data, error } = await supabase.from('followups').update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return data as Followup
}

export function buildWhatsAppLink(phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, '')
  const withCountryCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`
}

export const MESSAGE_TEMPLATES = {
  feedback: (name: string, product: string) =>
    `Hi ${name}, this is Sake of Health. We hope you're enjoying your ${product}. We'd love to hear your feedback — how has your experience been so far?`,
  reviewRequest: (name: string) =>
    `Hi ${name}, thank you for choosing Sake of Health! If you enjoyed your product, we'd really appreciate a quick review.`,
  repeatCheck: (name: string) =>
    `Hi ${name}, it's been a little while since your last order with Sake of Health. Would you like to restock, or try one of our other formulas?`,
}
