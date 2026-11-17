/**
 * POST /api/admin/account/set-password
 *
 * The signed-in staff member replaces their OWN password. Drives the forced
 * first-login change (an admin-created account starts on a temporary password
 * the admin knows) and is also available any time from the account menu.
 *
 * Deliberately exempt from the forced-change and 2FA gates in adminGuard, so a
 * freshly created account that is still flagged can actually reach it — it is
 * the one door left open while must_change_password is true.
 */
import { guardAdmin, ALL_ROLES } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: ALL_ROLES })
  if (!gate) return

  const { password } = req.body || {}
  if (!password || String(password).length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })

  // Change the password via the admin API (service role), then clear the flag.
  const { error } = await gate.db.auth.admin.updateUserById(gate.actor.id, { password: String(password) })
  if (error) return res.status(400).json({ error: error.message })

  await gate.db.from('profiles').update({ must_change_password: false }).eq('id', gate.actor.id)

  await gate.db.from('audit_logs').insert({
    tenant_id:   gate.tenantId,
    actor_id:    gate.actor.id,
    actor_role:  gate.actor.role,
    action:      'staff_password_changed',
    target_type: 'profile',
    target_id:   gate.actor.id,
    description: 'Staff member set a new password',
  }).then(() => {}, () => {})

  return res.status(200).json({ ok: true })
}
