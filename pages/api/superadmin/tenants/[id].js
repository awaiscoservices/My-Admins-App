/**
 * GET /api/superadmin/tenants/[id]
 * Returns full tenant detail including domain list.
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { id } = req.query

  const [{ data: tenant, error }, { data: domains }] = await Promise.all([
    supabaseAdmin.from('tenants').select('*').eq('id', id).single(),
    supabaseAdmin.from('tenant_domains').select('*').eq('tenant_id', id).order('created_at'),
  ])

  if (error || !tenant) return res.status(404).json({ error: 'Tenant not found' })

  return res.status(200).json({ tenant, domains: domains || [] })
}
