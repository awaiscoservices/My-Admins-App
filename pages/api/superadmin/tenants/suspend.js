/**
 * POST /api/superadmin/tenants/suspend
 * Suspend or reactivate a tenant. Blocks all their staff from /admin.
 * Body: { tenant_id, action: 'suspend' | 'activate', reason? }
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'

const TENANT_1 = '00000000-0000-0000-0000-000000000001'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { tenant_id, action, reason } = req.body
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id is required' })
  if (!['suspend', 'activate'].includes(action)) return res.status(400).json({ error: 'action must be suspend or activate' })

  // Prevent suspending the root tenant
  if (tenant_id === TENANT_1 && action === 'suspend')
    return res.status(403).json({ error: 'Cannot suspend the root tenant' })

  const { data: before } = await supabaseAdmin.from('tenants').select('status, name').eq('id', tenant_id).single()
  if (!before) return res.status(404).json({ error: 'Tenant not found' })

  const newStatus = action === 'suspend' ? 'suspended' : 'active'

  const { error } = await supabaseAdmin.from('tenants').update({
    status:     newStatus,
    updated_at: new Date().toISOString(),
    ...(action === 'suspend' ? { suspended_at: new Date().toISOString(), suspended_by: admin.id, suspend_reason: reason || null } : { suspended_at: null, suspended_by: null, suspend_reason: null }),
  }).eq('id', tenant_id)

  if (error) return res.status(500).json({ error: error.message })

  // Audit
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    admin.id,
    actor_role:  admin.role,
    action:      action === 'suspend' ? 'tenant_suspended' : 'tenant_activated',
    target_type: 'tenant',
    target_id:   tenant_id,
    before_state: { status: before.status },
    after_state:  { status: newStatus, reason },
  }).then(() => {}, () => {})

  return res.status(200).json({ status: newStatus, tenant_id })
}
