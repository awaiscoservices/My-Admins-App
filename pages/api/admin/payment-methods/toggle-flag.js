/**
 * pages/api/admin/payment-methods/toggle-flag.js
 *
 * POST { id, flag: 'allow_deposit'|'allow_withdraw', value: boolean }
 * → updates payment_methods SET <flag> = value WHERE id = id
 *
 * Admin-only. Uses service-role key (server-side only).
 */
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

const ALLOWED_FLAGS = ['allow_deposit', 'allow_withdraw']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Auth: must be signed-in admin ─────────────────────────────────────────
  const supabaseUser = createServerSupabaseClient({ req, res })
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Check is_staff via service role
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('is_staff')
    .eq('id', user.id)
    .single()

  if (!profile?.is_staff) return res.status(403).json({ error: 'Forbidden' })

  // ── Validate body ─────────────────────────────────────────────────────────
  const { id, flag, value } = req.body

  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' })
  if (!ALLOWED_FLAGS.includes(flag))  return res.status(400).json({ error: `flag must be one of: ${ALLOWED_FLAGS.join(', ')}` })
  if (typeof value !== 'boolean')     return res.status(400).json({ error: 'value must be boolean' })

  // ── Apply update ──────────────────────────────────────────────────────────
  const { data, error } = await admin
    .from('payment_methods')
    .update({ [flag]: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, allow_deposit, allow_withdraw')
    .single()

  if (error) {
    console.error('[toggle-flag]', error)
    return res.status(500).json({ error: error.message })
  }

  // ── Audit log (best-effort) ───────────────────────────────────────────────
  await admin.from('audit_logs').insert({
    actor_id:   user.id,
    action:     'payment_method.flag_changed',
    entity:     'payment_methods',
    entity_id:  id,
    metadata:   { flag, old_value: !value, new_value: value },
  }).then(() => {}) // ignore error — don't fail the request if audit table is missing

  return res.status(200).json({ ok: true, method: data })
}
