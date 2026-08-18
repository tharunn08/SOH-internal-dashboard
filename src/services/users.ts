import { supabase } from '../lib/supabase'
import type { UserRole } from '../types/domain'

export async function inviteUser(input: { email: string; password: string; name: string; role: UserRole }) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: input,
  })
  if (error) {
    // supabase-js wraps non-2xx responses in a generic error; try to surface
    // the specific message the edge function returned.
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    if (context?.json) {
      try {
        const body = await context.json()
        throw new Error(body.error || error.message)
      } catch {
        throw new Error(error.message)
      }
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
