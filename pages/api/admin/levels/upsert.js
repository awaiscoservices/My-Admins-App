/**
 * POST /api/admin/levels/upsert
 * Create or update a player level. super_admin only.
 * Body: { id?, name, sort_order, xp_required, accent_color, badge_color, badge_icon,
 *         kyc_required, is_active, description,
 *         max_redeem_cap_cents, min_redeem_multiplier, max_redeem_multiplier,
 *         min_withdrawal_cents, max_withdrawal_cents }
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.LEVELS_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor

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
    tenant_id: gate.tenantId,
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
    // No updated_at: player_levels has created_at only. Sending a column
    // that does not exist failed every save on the Player Levels page.
  }

  let result
  if (id) {
    // Scoped: the update filtered on id alone, so a level belonging to
    // another casino could be overwritten — and payload carries tenant_id,
    // which would have moved that row to the caller's casino.
    const { row: existing } = await loadOwnedRow(gate, 'player_levels', id, 'id')
    if (!existing) return res.status(404).json({ error: 'Level not found' })

    const { tenant_id: _owner, ...changes } = payload
    result = await supabaseAdmin
      .from('player_levels')
      .update(changes)
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
