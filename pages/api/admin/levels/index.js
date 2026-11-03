/**
 * GET /api/admin/levels   → list all levels ordered by display_order
 * PUT /api/admin/levels   → update level fields (super_admin only)
 *
 * Body for PUT: { id, min_xp?, deposit_bonus_pct?, daily_withdrawal_limit_cents?, bonus_to_cash_pct? }
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()

  // GET — all staff can view
  if (req.method === 'GET') {
    if (!actor || !['super_admin','admin','finance','game_ops'].includes(actor.role))
      return res.status(403).json({ error: 'Forbidden' })

    const { data, error } = await supabaseAdmin
      .from('player_levels')
      .select('id, name, min_xp, deposit_bonus_pct, daily_withdrawal_limit_cents, bonus_to_cash_pct, accent_color, display_order, is_active, description')
      .order('display_order', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ levels: data })
  }

  // PUT — super_admin only
  if (req.method === 'PUT') {
    if (!actor || actor.role !== 'super_admin')
      return res.status(403).json({ error: 'super_admin role required to edit levels' })

    const { id, min_xp, deposit_bonus_pct, daily_withdrawal_limit_cents, bonus_to_cash_pct } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    // Build update only with provided fields
    const updates = {}
    if (min_xp                      !== undefined) updates.min_xp                       = parseInt(min_xp)
    if (deposit_bonus_pct           !== undefined) updates.deposit_bonus_pct            = parseFloat(deposit_bonus_pct)
    if (daily_withdrawal_limit_cents !== undefined) updates.daily_withdrawal_limit_cents = parseInt(daily_withdrawal_limit_cents)
    if (bonus_to_cash_pct           !== undefined) updates.bonus_to_cash_pct            = parseFloat(bonus_to_cash_pct)

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: 'No fields to update' })

    // Validate XP ordering — no level should have min_xp <= the previous level
    if (updates.min_xp !== undefined) {
      const { data: allLevels } = await supabaseAdmin
        .from('player_levels').select('id, min_xp, display_order').order('display_order')

      const target = allLevels.find(l => l.id === id)
      if (target) {
        const prev = allLevels.filter(l => l.display_order < target.display_order).pop()
        const next = allLevels.find(l => l.display_order > target.display_order)
        if (prev && updates.min_xp <= prev.min_xp)
          return res.status(422).json({ error: `Min XP must be greater than ${prev.min_xp} (previous level)` })
        if (next && updates.min_xp >= next.min_xp)
          return res.status(422).json({ error: `Min XP must be less than ${next.min_xp} (next level)` })
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
      target_id:   id,
      description: `Level ${data.name} updated: ${JSON.stringify(updates)}`,
    })

    return res.status(200).json({ level: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
