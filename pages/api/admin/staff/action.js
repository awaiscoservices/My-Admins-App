import { guardAdmin, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.STAFF_MANAGE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const caller = gate.actor

  const { action, email, role, target_user_id, active } = req.body

  // Nobody hands out the platform-owner role through this route.
  const ASSIGNABLE = ['admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing']
  if (role && !ASSIGNABLE.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ASSIGNABLE.join(', ')}` })
  }

  // Any action naming a target must stay inside the caller's casino, and no
  // admin may act on a super admin.
  if (target_user_id) {
    const { row: t } = await loadOwnedRow(gate, 'profiles', target_user_id, 'id, role')
    if (!t) return res.status(404).json({ error: 'Staff member not found' })
    if (t.role === 'super_admin' && !gate.isSuperAdmin) {
      return res.status(403).json({ error: 'Cannot modify a super admin' })
    }
    if (target_user_id === caller.id) {
      return res.status(400).json({ error: 'Cannot modify your own account' })
    }
  }

  if (action === 'invite') {
    if (!email?.trim() || !role) return res.status(400).json({ error: 'email and role required' })
    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim())
    if (invErr) return res.status(500).json({ error: invErr.message })
    await supabaseAdmin.from('profiles').update({ role, tenant_id: gate.tenantId }).eq('id', invited.user.id)
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: gate.tenantId,
      actor_id: caller.id, actor_role: caller.role,
      action: 'staff_invite',
      target_type: 'profile', target_id: invited.user.id,
      description: `Invited ${email} as ${role}`,
      metadata: { email, role }
    })
    return res.status(200).json({ success: true })
  }

  if (action === 'update_role') {
    if (!target_user_id || !role) return res.status(400).json({ error: 'target_user_id and role required' })
    const { error } = await supabaseAdmin.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', target_user_id)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: gate.tenantId,
      actor_id: caller.id, actor_role: caller.role,
      action: 'staff_role_change',
      target_type: 'profile', target_id: target_user_id,
      description: `Changed staff role to ${role}`,
      metadata: { new_role: role }
    })
    return res.status(200).json({ success: true })
  }

  if (action === 'toggle_active') {
    if (!target_user_id) return res.status(400).json({ error: 'target_user_id required' })
    const { error } = await supabaseAdmin.from('profiles').update({ status: active ? 'active' : 'suspended', updated_at: new Date().toISOString() }).eq('id', target_user_id)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: gate.tenantId,
      actor_id: caller.id, actor_role: caller.role,
      action: active ? 'staff_activate' : 'staff_deactivate',
      target_type: 'profile', target_id: target_user_id,
      description: `Staff member ${active ? 'activated' : 'deactivated'}`,
    })
    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: 'Unknown action' })
}
