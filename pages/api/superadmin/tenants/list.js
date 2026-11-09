/**
 * GET /api/superadmin/tenants/list
 * Paginated tenant list with search + status filter.
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const page   = Math.max(1, parseInt(req.query.page  || '1'))
  const limit  = Math.min(100, parseInt(req.query.limit || '20'))
  const search = req.query.search?.trim() || ''
  const status = req.query.status?.trim() || ''

  const from = (page - 1) * limit
  const to   = from + limit - 1

  let q = supabaseAdmin
    .from('tenants')
    .select('id, name, slug, status, plan, contact_email, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search) q = q.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
  if (status) q = q.eq('status', status)

  const { data: tenants, count, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ tenants: tenants || [], total: count || 0, page, limit })
}
