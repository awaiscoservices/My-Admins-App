/**
 * GET  /api/superadmin/tenants/domains?tenant_id=…  — list domains
 * POST /api/superadmin/tenants/domains               — add domain
 * Body (POST): { tenant_id, domain }
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

export default async function handler(req, res) {
  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const { tenant_id } = req.query
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' })

    const { data: domains, error } = await supabaseAdmin
      .from('tenant_domains')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ domains: domains || [] })
  }

  if (req.method === 'POST') {
    const { tenant_id, domain } = req.body
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' })
    if (!domain?.trim()) return res.status(400).json({ error: 'domain required' })

    // Basic domain format check
    const domainRegex = /^([a-z0-9-]+\.)+[a-z]{2,}$/i
    if (!domainRegex.test(domain.trim())) return res.status(400).json({ error: 'Invalid domain format' })

    // Check uniqueness
    const { data: existing } = await supabaseAdmin.from('tenant_domains').select('id').eq('domain', domain.trim()).maybeSingle()
    if (existing) return res.status(409).json({ error: 'Domain already registered' })

    const { data: row, error } = await supabaseAdmin
      .from('tenant_domains')
      .insert({ tenant_id, domain: domain.trim(), is_verified: false, created_by: admin.id })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ domain: row })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
