import { guardAdmin, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

/**
 * POST /api/admin/games/maintenance   { id, under_maintenance }
 *
 * Flips a single game panel's maintenance flag. While on, players cannot load,
 * redeem, request a new account, or request a password change for that game —
 * enforced server-side in the player RPCs/routes, not here. Tenant-scoped: an
 * admin can only toggle a panel in their own casino.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.GAMES_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { id, under_maintenance } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id required' })

  const { row: existing } = await loadOwnedRow(gate, 'game_panels', id, 'id')
  if (!existing) return res.status(404).json({ error: 'Game not found' })

  const next = under_maintenance === true
  const { error } = await supabaseAdmin
    .from('game_panels')
    .update({ under_maintenance: next, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('audit_logs').insert({
    tenant_id: gate.tenantId, actor_id: admin.id, actor_role: admin.role,
    action: next ? 'game_maintenance_on' : 'game_maintenance_off',
    target_type: 'game_panel', target_id: id,
    description: `Game ${next ? 'put under' : 'taken out of'} maintenance: ${existing.name || id}`,
    metadata: { under_maintenance: next },
  }).then(() => {}, () => {})

  return res.status(200).json({ success: true, under_maintenance: next })
}
