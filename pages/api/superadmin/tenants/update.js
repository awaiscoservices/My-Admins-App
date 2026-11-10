/**
 * POST /api/superadmin/tenants/update
 * Updates tenant name, plan, owner email, brand name and primary domain.
 * Body: { tenant_id, name?, plan?, owner_email?, brand_name?, primary_domain? }
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { tenant_id, name, plan, owner_email, brand_name, primary_domain } = req.body
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id is required' })

  // Load current state for audit
  const { data: before } = await supabaseAdmin.from('tenants').select('*').eq('id', tenant_id).single()
  if (!before) return res.status(404).json({ error: 'Tenant not found' })

  const updates = {}
  if (name         !== undefined) updates.name          = name.trim()
  if (plan         !== undefined) updates.plan          = plan
  if (owner_email    !== undefined) updates.owner_email    = owner_email?.trim() || null
  if (brand_name     !== undefined) updates.brand_name     = brand_name?.trim() || null
  if (primary_domain !== undefined) updates.primary_domain = primary_domain?.trim() || null
  updates.updated_at = new Date().toISOString()

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .update(updates)
    .eq('id', tenant_id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Audit
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    admin.id,
    actor_role:  admin.role,
    action:      'tenant_updated',
    target_type: 'tenant',
    target_id:   tenant_id,
    before_state: before,
    after_state:  updates,
  }).then(() => {}, () => {})

  return res.status(200).json({ tenant })
}
