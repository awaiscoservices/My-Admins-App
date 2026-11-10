/**
 * GET /api/admin/staff/list
 * Staff for the caller's own casino. Super admins see everyone.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.STAFF_MANAGE })
  if (!gate) return

  let q = gate.db
    .from('profiles')
    .select('id, full_name, email, username, role, status, tenant_id, created_at')
    .neq('role', 'player')
    .order('created_at', { ascending: false })

  q = scopeToTenant(q, gate)

  // An admin runs one casino and should not see the platform owner either.
  if (!gate.isSuperAdmin) q = q.neq('role', 'super_admin')

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ rows: data || [] })
}
