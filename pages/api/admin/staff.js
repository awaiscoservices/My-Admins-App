/**
 * GET  /api/admin/staff                      → everyone with a staff role
 * POST /api/admin/staff { email | user_id, role }   (role may be 'player' to remove staff access)
 * Super admins only. Protected: you can't change your own role, and the last super admin can't be removed.
 */
import { supabaseAdmin, requireStaff, audit, notify } from '../../../lib/adminApi'
import { STAFF_ROLES } from '../../../lib/adminSchemas'

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  const admin = await requireStaff(req, res, ['super_admin', 'admin'])
  if (!admin) return

  if (req.method === 'GET') {
    let lq = admin.scope(supabaseAdmin.from('profiles').select('*').neq('role', 'player').order('full_name', { ascending: true }))
    if (!admin.isSuperAdmin) lq = lq.neq('role', 'super_admin')
    const { data, error } = await lq
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ rows: (data || []).map(p => ({ id: p.id, name: p.full_name, email: p.email || null, role: p.role })), me: admin.id })
  }

  const { email, user_id, role } = req.body || {}
  if (![...STAFF_ROLES, 'player'].includes(role)) return res.status(400).json({ error: 'Invalid role' })

  let target
  if (user_id) target = (await admin.scope(supabaseAdmin.from('profiles').select('*').eq('id', user_id)).maybeSingle()).data
  else if (email) {
    const { data } = await admin.scope(supabaseAdmin.from('profiles').select('*').eq('email', String(email).trim().toLowerCase())).maybeSingle()
    target = data
  }
  if (!target) return res.status(404).json({ error: 'No account found with that email. They need to register first.' })
  if (target.id === admin.id) return res.status(400).json({ error: "You can't change your own role" })
  if (target.role === role) return res.status(400).json({ error: `Already ${role.replace('_', ' ')}` })

  if (target.role === 'super_admin' && role !== 'super_admin') {
    const { data: supers } = await supabaseAdmin.from('profiles').select('id').eq('role', 'super_admin')
    if ((supers || []).length <= 1) return res.status(400).json({ error: "You can't remove the last super admin" })
  }

  const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', target.id)
  if (error) return res.status(400).json({ error: error.message })
  await audit(admin, 'staff_role_change', 'profile', target.id, { role: target.role }, { role })
  await notify(target.id, 'general', 'Your access changed', role === 'player' ? 'Your staff access was removed.' : `You now have the "${role.replace('_', ' ')}" staff role.`)
  return res.status(200).json({ message: role === 'player' ? 'Staff access removed' : 'Role saved' })
}
