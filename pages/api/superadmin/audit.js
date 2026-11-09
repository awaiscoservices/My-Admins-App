/**
 * GET /api/superadmin/audit
 * Returns audit logs, optionally filtered by tenant_id.
 * Query: { tenant_id?, limit?, page? }
 */
import { guardSuperAdmin, supabaseAdmin } from './_guard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const page      = Math.max(1, parseInt(req.query.page  || '1'))
  const limit     = Math.min(200, parseInt(req.query.limit || '50'))
  const tenant_id = req.query.tenant_id || null
  const from      = (page - 1) * limit
  const to        = from + limit - 1

  let q = supabaseAdmin
    .from('audit_logs')
    .select('id, actor_id, actor_role, action, target_type, target_id, before_state, after_state, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (tenant_id) {
    // Filter by any action that references this tenant
    q = q.eq('target_id', tenant_id)
  }

  const { data: logs, count, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ logs: logs || [], total: count || 0, page, limit })
}
