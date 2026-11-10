/**
 * POST /api/admin/players/status
 * Change a player's account status (active/suspended/banned).
 * Requires finance or super_admin role.
 */
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PLAYER_STATUS })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { player_id, status, reason } = req.body

  if (!player_id || !status) return res.status(400).json({ error: 'player_id and status required' })
  if (!['active', 'suspended', 'banned'].includes(status))
    return res.status(400).json({ error: 'Invalid status' })
  if (status !== 'active' && !reason?.trim())
    return res.status(400).json({ error: 'Reason required for suspend/ban' })

  // Cannot modify another admin
  // Scoped: a player in another casino is not found, so cannot be banned here.
  const { row: target } = await loadOwnedRow(
    gate, 'profiles', player_id, 'id, role, status, full_name, tenant_id'
  )

  if (!target) return res.status(404).json({ error: 'Player not found' })
  const tenantId = tenantOf(target, gate)
  if (target.role !== 'player')
    return res.status(403).json({ error: 'Cannot modify staff accounts here' })

  const before = { status: target.status }

  await supabaseAdmin.from('profiles').update({
    status,
    flag_reason: status !== 'active' ? reason : null,
  }).eq('id', player_id)

  // Notify player
  const messages = {
    suspended: `Your account has been temporarily suspended. Reason: ${reason}. Contact support for assistance.`,
    banned:    `Your account has been banned. Reason: ${reason}. Contact support if you believe this is an error.`,
    active:    'Your account has been reactivated. You can now log in and play.',
  }
  await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId,
    user_id: player_id,
    title: status === 'active' ? 'Account Reactivated' : `Account ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: messages[status],
  })

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: admin.id, actor_role: admin.role,
    action: `player_status_changed_to_${status}`,
    target_type: 'player', target_id: player_id,
    before_state: before, after_state: { status },
    reason,
  }).then(() => {}, () => {})

  return res.status(200).json({ message: `Player ${status} successfully` })
}
