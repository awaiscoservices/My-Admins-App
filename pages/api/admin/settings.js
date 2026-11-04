/**
 * GET /api/admin/settings  → list all platform settings
 * PUT /api/admin/settings  → update a setting { key, value }
 *
 * super_admin only for PUT; all staff for GET.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()

  if (req.method === 'GET') {
    if (!actor || !['super_admin','admin','finance','game_ops'].includes(actor.role))
      return res.status(403).json({ error: 'Forbidden' })

    const { data, error } = await supabaseAdmin.from('platform_settings').select('key, value')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ settings: data })
  }

  if (req.method === 'PUT') {
    if (!actor || actor.role !== 'super_admin')
      return res.status(403).json({ error: 'super_admin required' })

    const { key, value } = req.body
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' })
    if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: `Unknown setting: ${key}` })

    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' })
      .select().single()

    if (error) return res.status(500).json({ error: error.message })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id:    user.id,
      actor_role:  actor.role,
      action:      'platform_setting_updated',
      target_type: 'platform_setting',
      target_id:   key,
      description: `Setting "${key}" set to "${value}"`,
    })

    return res.status(200).json({ setting: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
