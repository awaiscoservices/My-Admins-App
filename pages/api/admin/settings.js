/**
 * GET /api/admin/settings  → the caller's own casino's settings
 * PUT /api/admin/settings  → update one { key, value }
 *
 * Settings belong to a casino, not the platform. The table is keyed on
 * (tenant_id, key), so each casino holds its own copy of every setting and
 * one operator's limits never apply to another's players.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../lib/adminGuard'

const ALLOWED_KEYS = [
  'withdrawal_daily_limit_enabled',
  'min_withdrawal_cents',
  'max_withdrawal_cents',
  'deposit_bonus_enabled',
  'referral_bonus_enabled',
  'kyc_required_global',
  'maintenance_mode',
  'support_email',
  'platform_name',
]

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const gate = await guardAdmin(req, res, { allow: PERMS.SETTINGS_READ })
    if (!gate) return

    const { data, error } = await scopeToTenant(
      gate.db.from('platform_settings').select('key, value'),
      gate,
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ settings: data || [] })
  }

  if (req.method === 'PUT') {
    const gate = await guardAdmin(req, res, { allow: PERMS.SETTINGS_WRITE })
    if (!gate) return

    const { key, value } = req.body || {}
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' })
    if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: `Unknown setting: ${key}` })

    // A super admin has no casino of their own, so there is nothing to write
    // into. They change a casino's settings from inside that casino.
    if (!gate.tenantId) {
      return res.status(400).json({ error: 'Settings belong to a casino. Open the casino you want to change.' })
    }

    const { data, error } = await gate.db
      .from('platform_settings')
      .upsert(
        {
          tenant_id:  gate.tenantId,
          key,
          value:      String(value),
          updated_by: gate.actor.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,key' },
      )
      .select().single()

    if (error) return res.status(500).json({ error: error.message })

    await gate.db.from('audit_logs').insert({
      tenant_id:   gate.tenantId,
      actor_id:    gate.actor.id,
      actor_role:  gate.actor.role,
      action:      'platform_setting_updated',
      target_type: 'platform_setting',
      target_id:   key,
      description: `Setting "${key}" set to "${value}"`,
    }).then(() => {}, () => {})

    return res.status(200).json({ setting: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
