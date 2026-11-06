/**
 * POST /api/admin/levels/upsert
 * Create or update a player level. super_admin only.
 * Body: { id?, name, sort_order, xp_required, accent_color, badge_color, badge_icon,
 *         kyc_required, is_active, description,
 *         max_redeem_cap_cents, min_redeem_multiplier, max_redeem_multiplier,
 *         min_withdrawal_cents, max_withdrawal_cents }
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!actor || actor.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })

  const {
    id,
    name,
    sort_order,
    xp_required,
    accent_color,
    badge_color,
    badge_icon,
    kyc_required,
    is_active,
    description,
    max_redeem_cap_cents,
    min_redeem_multiplier,
    max_redeem_multiplier,
    min_withdrawal_cents,
    max_withdrawal_cents,
  } = req.body

  if (!name) return res.status(400).json({ error: 'name is required' })

  const payload = {
    name,
    sort_order: sort_order ?? 0,
    xp_required: xp_required ?? 0,
    accent_color: accent_color ?? '#fbbf24',
    badge_color: badge_color ?? '#fbbf24',
    badge_icon: badge_icon ?? null,
    kyc_required: kyc_required ?? false,
    is_active: is_active ?? true,
    description: description ?? null,
    max_redeem_cap_cents: max_redeem_cap_cents ?? null,
    min_redeem_multiplier: min_redeem_multiplier ?? null,
    max_redeem_multiplier: max_redeem_multiplier ?? null,
    min_withdrawal_cents: min_withdrawal_cents ?? null,
    max_withdrawal_cents: max_withdrawal_cents ?? null,
    updated_at: new Date().toISOString(),
  }

  let result
  if (id) {
    result = await supabaseAdmin
      .from('player_levels')
      .update(payload)
      .eq('id', id)
      .select('id')
      .single()
  } else {
    result = await supabaseAdmin
      .from('player_levels')
      .insert(payload)
      .select('id')
      .single()
  }

  if (result.error) return res.status(500).json({ error: result.error.message })

  await supabaseAdmin.from('audit_logs').insert({
    action: id ? 'level_update' : 'level_create',
    performed_by: user.id,
    target_type: 'player_level',
    target_id: result.data.id,
    details: { name, sort_order, xp_required },
  })

  return res.status(200).json({ success: true, id: result.data.id })
}
