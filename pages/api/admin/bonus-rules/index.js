/**
 * GET  /api/admin/bonus-rules        → list all rules
 * POST /api/admin/bonus-rules        → create rule
 * PUT  /api/admin/bonus-rules        → update rule  (body: { id, ...fields })
 * DELETE /api/admin/bonus-rules?id=  → delete rule
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  const gate = await guardAdmin(req, res, { allow: PERMS.BONUSES_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor

  // LIST
  if (req.method === 'GET') {
    const { data, error } = await scopeToTenant(
      supabaseAdmin
        .from('deposit_bonus_rules')
        .select('*, min_level:player_levels!min_level_id(name), max_level:player_levels!max_level_id(name)')
        .order('created_at', { ascending: false }),
      gate,
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rules: data })
  }

  // CREATE
  if (req.method === 'POST') {
    const {
      name, description, bonus_pct, flat_bonus_cents, max_bonus_cents,
      min_deposit_cents, min_level_id, max_level_id,
      valid_from, valid_until, per_player_limit, is_active,
    } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })

    const { data, error } = await supabaseAdmin
      .from('deposit_bonus_rules')
      .insert({
        name, description,
        bonus_pct:        bonus_pct        ?? 0,
        flat_bonus_cents: flat_bonus_cents ?? 0,
        max_bonus_cents:  max_bonus_cents  ?? null,
        min_deposit_cents: min_deposit_cents ?? 0,
        min_level_id:     min_level_id     ?? null,
        max_level_id:     max_level_id     ?? null,
        valid_from:       valid_from       ?? null,
        valid_until:      valid_until      ?? null,
        per_player_limit: per_player_limit ?? null,
        is_active:        is_active        ?? true,
        created_by:       user.id,
      })
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ rule: data })
  }

  // UPDATE
  if (req.method === 'PUT') {
    const { id, ...fields } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabaseAdmin
      .from('deposit_bonus_rules')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rule: data })
  }

  // DELETE
  if (req.method === 'DELETE') {
    const id = req.query.id
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabaseAdmin
      .from('deposit_bonus_rules').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
