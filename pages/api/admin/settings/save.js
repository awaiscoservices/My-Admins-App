/**
 * POST /api/admin/settings/save
 * Body: { key, value }
 * Writes a setting for the caller's own casino.
 */
import { guardAdmin, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.SETTINGS_WRITE })
  if (!gate) return

  const { key, value } = req.body || {}
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' })

  // A super admin has no casino of their own to write into.
  if (!gate.tenantId) {
    return res.status(400).json({ error: 'Settings belong to a casino. Open the casino you want to change.' })
  }

  const { error } = await gate.db
    .from('platform_settings')
    .upsert(
      { tenant_id: gate.tenantId, key, value, updated_by: gate.actor.id, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,key' },
    )
  if (error) return res.status(500).json({ error: error.message })

  await gate.db.from('audit_logs').insert({
    tenant_id: gate.tenantId,
    actor_id: gate.actor.id,
    actor_role: gate.actor.role,
    action: 'setting_changed',
    target_type: 'platform_settings',
    target_id: key,
    details: { key, value },
  }).then(() => {}, () => {})

  return res.status(200).json({ ok: true })
}
