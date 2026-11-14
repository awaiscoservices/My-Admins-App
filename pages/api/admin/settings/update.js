import { guardAdmin, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.SETTINGS_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  if (!gate.tenantId) {
    return res.status(400).json({ error: 'Settings belong to a casino. Open the casino you want to change.' })
  }

  const { updates } = req.body
  if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'updates array required' })

  for (const { key, value } of updates) {
    if (!key) continue
    await supabaseAdmin.from('platform_settings').upsert(
      { tenant_id: gate.tenantId, key, value, updated_at: new Date().toISOString(), updated_by: admin.id },
      { onConflict: 'tenant_id,key' }
    )
  }

  await supabaseAdmin.from('audit_logs').insert({
    tenant_id: gate.tenantId,
    actor_id: admin.id,
    actor_role: admin.role,
    action: 'setting_update',
    target_type: 'settings', target_id: null,
    description: `Updated settings: ${updates.map(u => u.key).join(', ')}`,
    metadata: { keys: updates.map(u => u.key) }
  })

  return res.status(200).json({ success: true })
}
