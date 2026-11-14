import crypto from 'crypto'
import { guardAdmin, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

// super_admin is not here on purpose: the platform-owner role is not handed
// out through staff management.
const VALID_ROLES = ['admin', 'finance', 'game_ops', 'support', 'kyc_agent', 'risk', 'reporting', 'marketing']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.STAFF_MANAGE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor
  const user = gate.actor

  const { action, staff_id, role, email, full_name } = req.body

  if (action === 'invite') {
    // Create auth user + profile with staff role
    if (!email?.trim() || !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Valid email and role required' })
    // Math.random() is not cryptographically secure and this gave only ~8
    // base36 characters, for accounts that can move money. 24 hex chars from
    // crypto.randomBytes instead.
    const tempPassword = crypto.randomBytes(12).toString('hex') + 'X1!'
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(), password: tempPassword, email_confirm: true,
      user_metadata: { full_name: full_name?.trim() || email.split('@')[0] }
    })
    if (createErr) return res.status(400).json({ error: createErr.message })
    await supabaseAdmin.from('profiles').update({ role, tenant_id: gate.tenantId, full_name: full_name?.trim() || email.split('@')[0] }).eq('id', newUser.user.id)
    await supabaseAdmin.from('audit_logs').insert({ tenant_id: gate.tenantId, actor_id: actor.id, actor_role: actor.role, action: 'staff_invited', target_type: 'profiles', target_id: newUser.user.id, description: `Invited ${email} as ${role}`, metadata: { email, role } }).then(() => {}, () => {})
    return res.status(201).json({ message: 'Staff invited', temp_password: tempPassword })
  }

  if (action === 'update_role') {
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' })
    if (staff_id === user.id) return res.status(400).json({ error: 'Cannot change own role' })

    // staff/update.js refuses to touch another super_admin; this route did not,
    // so the rule could simply be bypassed by calling this one instead.
    const { row: target } = await loadOwnedRow(gate, 'profiles', staff_id, 'id, role')
    if (!target) return res.status(404).json({ error: 'Staff member not found' })
    if (target.role === 'super_admin')
      return res.status(403).json({ error: 'Cannot modify another super admin' })

    await supabaseAdmin.from('profiles').update({ role }).eq('id', staff_id)
    await supabaseAdmin.from('audit_logs').insert({ tenant_id: gate.tenantId, actor_id: user.id, actor_role: user.role, action: 'staff_role_changed', target_type: 'profiles', target_id: staff_id, description: `Changed staff role to ${role}`, metadata: { new_role: role } }).then(() => {}, () => {})
    return res.status(200).json({ message: 'Role updated' })
  }

  if (action === 'deactivate') {
    if (staff_id === user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' })

    // Same hole: this banned the account for 100 years with no super_admin
    // check, so one super admin could lock out every other one.
    const { row: target } = await loadOwnedRow(gate, 'profiles', staff_id, 'id, role')
    if (!target) return res.status(404).json({ error: 'Staff member not found' })
    if (target.role === 'super_admin')
      return res.status(403).json({ error: 'Cannot deactivate another super admin' })

    await supabaseAdmin.from('profiles').update({ status: 'suspended' }).eq('id', staff_id)
    await supabaseAdmin.auth.admin.updateUserById(staff_id, { ban_duration: '876600h' })
    await supabaseAdmin.from('audit_logs').insert({ tenant_id: gate.tenantId, actor_id: user.id, actor_role: user.role, action: 'staff_deactivated', target_type: 'profiles', target_id: staff_id, description: 'Staff member deactivated' }).then(() => {}, () => {})
    return res.status(200).json({ message: 'Staff deactivated' })
  }

  return res.status(400).json({ error: 'Invalid action' })
}
