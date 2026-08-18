// Supabase Edge Function: create-user
//
// Lets an authenticated admin create a new team login (auth user) directly
// from the dashboard's Users page. This has to run server-side because
// creating auth users requires the Supabase service_role key, which must
// never be shipped to the browser.
//
// Deploy with the Supabase CLI:
//   supabase functions deploy create-user
// Then set the service role key as a function secret (NOT in your .env,
// NOT in the frontend):
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
//
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically to every
// edge function by Supabase — you don't need to set those yourself.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    // Client scoped to the caller's own JWT — used only to verify who is calling.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !caller) {
      return json({ error: 'Not authenticated' }, 401)
    }

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profileErr || callerProfile?.role !== 'admin') {
      return json({ error: 'Only admins can create users' }, 403)
    }

    const { email, password, name, role } = await req.json()

    if (!email || !password || password.length < 6) {
      return json({ error: 'A valid email and a password of at least 6 characters are required' }, 400)
    }
    if (!['admin', 'manager', 'staff'].includes(role)) {
      return json({ error: 'Invalid role' }, 400)
    }

    // Privileged client — service_role key lives only here, as a function secret.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email.split('@')[0] },
    })

    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'Could not create user' }, 400)
    }

    // The DB trigger (handle_new_auth_user) already mirrored a row into
    // public.users with a default role — update it to the role the admin chose.
    const { error: updateErr } = await adminClient
      .from('users')
      .update({ role, name: name || email.split('@')[0] })
      .eq('id', created.user.id)

    if (updateErr) {
      return json({ error: `User created, but role assignment failed: ${updateErr.message}` }, 500)
    }

    await adminClient.from('audit_logs').insert({
      user_id: caller.id,
      action: 'created',
      entity_type: 'user',
      entity_id: created.user.id,
      description: `User ${email} created with role ${role}`,
    })

    return json({ success: true, user: { id: created.user.id, email } }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
