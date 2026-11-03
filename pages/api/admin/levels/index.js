/**
 * GET /api/admin/levels   → list all levels with every column
 * PUT /api/admin/levels   → update any level field (super_admin only)
 *
 * Body for PUT: { id, ...any updatable fields }
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// All columns admin is allowed to edit (everything except id, name, created_at)
const EDITABLE = [
  'min_xp',
  'deposit_bonus_pct',
  'daily_withdrawal_limit_cents',
  'max_daily_withdrawal_cents',
  'bonus_to_cash_pct',
  'redeem_multiplier',
  'min_deposit_cents',
  'max_deposit_cents',
  'min_withdrawal_cents',
  'max_withdrawal_cents',
  'min_game_load_cents',
  'max_game_load_cents',
  'min_redeem_cents',
  'max_redeem_cents',
  'referral_bonus_cents',
  'kyc_required',
  'deposit_threshold_cents',
  'description',
  'accent_color',
  'is_active',
  'perks',
]

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()

  // GET — all staff
  if (req.method === 'GET') {
    if (!actor || !['super_admin','admin','finance','game_ops'].includes(actor.role))
      return res.status(403).json({ error: 'Forbidden' })

    const { data, error } = await supabaseAdmin
      .from('player_levels')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ levels: data })
  }

  // PUT — super_admin only
  if (req.method === 'PUT') {
    if (!actor || actor.role !== 'super_admin')
      return res.status(403).json({ error: 'super_admin role required to edit levels' })

    const { id, ...body } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    // Only allow whitelisted fields
    const updates = {}
    for (const key of EDITABLE) {
      if (body[key] !== undefined) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: 'No valid fields to update' })

    // XP ordering guard
    if (updates.min_xp !== undefined) {
      const { data: allLevels } = await supabaseAdmin
        .from('player_levels').select('id, min_xp, display_order, name').order('display_order')
      const target = allLevels.find(l => l.id === id)
      if (target) {
        const prev = allLevels.filter(l => l.display_order < target.display_order).pop()
        const next = allLevels.find(l => l.display_order > target.display_order)
        if (prev && updates.min_xp <= prev.min_xp)
          return res.status(422).json({ error: `Min XP must be > ${prev.min_xp} (${prev.name})` })
        if (next && updates.min_xp >= next.min_xp)
          return res.status(422).json({ error: `Min XP must be < ${next.min_xp} (${next.name})` })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('player_levels')
      .update(updates)
      .eq('id', id)
      .select().single()

    if (error) return res.status(500).json({ error: error.message })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id:    user.id,
      actor_role:  actor.role,
      action:      'level_config_updated',
      target_type: 'player_level',
      target_id:   String(id),
      description: `Level "${data.name}" updated: ${JSON.stringify(updates)}`,
    })

    return res.status(200).json({ level: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
