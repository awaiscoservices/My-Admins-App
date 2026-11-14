/**
 * POST /api/admin/staff/update
 *
 * Body: { user_id, action: 'change_role'|'deactivate', role? }
 * super_admin only. Cannot act on another super_admin or self.
 */
import { guardAdmin, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

const ASSIGNABLE_ROLES = ['admin', 'finance', 'game_ops', 'support']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.STAFF_MANAGE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor
  const user = gate.actor

  const { user_id, action, role } = req.body
  if (!user_id || !['change_role', 'deactivate'].includes(action))
    return res.status(400).json({ error: 'user_id and action required' })
  if (user_id === user.id)
    return res.status(400).json({ error: 'Cannot modify your own account' })

  // Scoped: an admin can only act on staff in their own casino.
  const { row: target } = await loadOwnedRow(gate, 'profiles', user_id, 'id, role, full_name, tenant_id')
  if (!target) return res.status(404).json({ error: 'Staff member not found' })
  if (target.role === 'super_admin') return res.status(403).json({ error: 'Cannot modify another super_admin' })

  if (action === 'change_role') {
    if (!ASSIGNABLE_ROLES.includes(role))
      return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` })

    await supabaseAdmin.from('profiles').update({ role }).eq('id', user_id)

    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: target.tenant_id,
      actor_id: user.id, actor_role: actor.role,
      action: 'staff_role_changed', target_type: 'profile', target_id: user_id,
      description: `${target.full_name} role changed from ${target.role} to ${role}`,
    })

    return res.status(200).json({ ok: true })
  }

  if (action === 'deactivate') {
    // Previously this set is_active alone: the Staff list greyed them out
    // while their login still worked and the panel still let them in.
    await supabaseAdmin.from('profiles')
      .update({ status: 'suspended' })
      .eq('id', user_id)

    // Revoke the session itself, so an already-signed-in tab cannot keep
    // working until the token expires.
    await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: '876600h' })
      .then(() => {}, () => {})

    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: target.tenant_id,
      actor_id: user.id, actor_role: actor.role,
      action: 'staff_deactivated', target_type: 'profile', target_id: user_id,
      description: `${target.full_name} (${target.role}) deactivated`,
    })

    return res.status(200).json({ ok: true })
  }
}
