/**
 * GET /api/admin/settings/get
 * Settings for the caller's own casino.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.SETTINGS_READ })
  if (!gate) return

  const { data, error } = await scopeToTenant(
    gate.db.from('platform_settings').select('key, value, description').order('key'),
    gate,
  )
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ settings: data || [] })
}
