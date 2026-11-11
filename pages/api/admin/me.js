/**
 * GET /api/admin/me
 *
 * Who is signed in, and which casino this panel is for.
 *
 * The casino's name cannot be read from the browser: `tenants` is not a
 * table a staff session is given access to, and the layout only ever had
 * the tenant's id. This resolves the name server-side for the caller's own
 * casino — never any other.
 */
import { guardAdmin, PERMS } from '../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // The widest list there is: every signed-in staff member may see their own
  // name and which casino they work for.
  const gate = await guardAdmin(req, res, { allow: PERMS.PENDING_COUNTS })
  if (!gate) return

  let tenant_name = null
  if (gate.tenantId) {
    const { data: tenant } = await gate.db
      .from('tenants')
      .select('name, brand_name')
      .eq('id', gate.tenantId)
      .maybeSingle()
    tenant_name = tenant?.brand_name || tenant?.name || null
  }

  return res.status(200).json({
    id:          gate.actor.id,
    full_name:   gate.actor.full_name || null,
    email:       gate.actor.email || null,
    role:        gate.actor.role,
    tenant_name,                              // null for a super admin
    is_super_admin: gate.isSuperAdmin,
  })
}
