/**
 * POST /api/admin/levels/upsert
 *
 * Create or update a player level with the simplified schema:
 *   name, sort_order, xp_required, accent_color, badge_color, badge_icon,
 *   kyc_required, is_active, description,
 *   max_redeem_cap_cents, min_redeem_multiplier, max_redeem_multiplier,
 *   min_withdrawal_cents, max_withdrawal_cents
 *
 * Bonus fields are intentionally excluded — they live under Player Bonuses.
 * Game Load limits are intentionally excluded — no limit on load amount.
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

  const { data: admin } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!admin || admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })

  const {
    level_id,
    name,
    sort_order,
    xp_required,
    accent_color,
    badge_color,
    badge_icon,
    kyc_required,
    is_active,
    description,
    // Redeem caps (stored in cents / multiplier)
    max_redeem_cap_cents,
    min_redeem_multiplier,
    max_redeem_multiplier,
    // Withdraw limits (stored in cents)
    min_withdrawal_cents,
    max_withdrawal_cents,
  } = req.body

  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })

  // Validate multipliers
  const minMult = parseFloat(min_redeem_multiplier)
  const maxMult = parseFloat(max_redeem_multiplier)
  if (isNaN(minMult) || minMult < 0) return res.status(400).json({ error: 'min_redeem_multiplier must be >= 0' })
  if (isNaN(maxMult) || maxMult < minMult) return res.status(400).json({ error: 'max_redeem_multiplier must be >= min_redeem_multiplier' })

  const payload = {
    name:                   name.trim(),
    sort_order:             sort_order != null ? parseInt(sort_order) : 0,
    xp_required:            xp_required != null ? parseInt(xp_required) : 0,
    accent_color:           accent_color || '#fbbf24',
    badge_color:            badge_color  || accent_color || '#fbbf24',
    badge_icon:             badge_icon   || null,
    kyc_required:           !!kyc_required,
    is_active:              is_active !== false,
    description:            description  || null,
    max_redeem_cap_cents:   max_redeem_cap_cents   != null ? parseInt(max_redeem_cap_cents)   : 50000,
    min_redeem_multiplier:  minMult,
    max_redeem_multiplier:  maxMult,
    min_withdrawal_cents:   min_withdrawal_cents   != null ? parseInt(min_withdrawal_cents)   : 0,
    max_withdrawal_cents:   max_withdrawal_cents   != null ? parseInt(max_withdrawal_cents)   : null,
  }

  let error, data
  if (level_id) {
    ;({ error, data } = await supabaseAdmin.from('player_levels').update(payload).eq('id', level_id).select('id').single())
  } else {
    ;({ error, data } = await supabaseAdmin.from('player_levels').insert(payload).select('id').single())
  }
  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('audit_logs').insert({
    action:      level_id ? 'level_update' : 'level_create',
    performed_by: admin.id,
    target_type: 'player_level',
    target_id:   level_id || data?.id,
    details:     { name, sort_order, min_redeem_multiplier: minMult, max_redeem_multiplier: maxMult, max_redeem_cap_cents },
  }).then(() => {}) // fire-and-forget

  return res.status(200).json({ success: true, id: level_id || data?.id })
}
