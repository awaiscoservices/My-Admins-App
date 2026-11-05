/**
 * GET /api/admin/levels/list
 * Returns all player levels ordered by sort_order.
 * Returns only the simplified fields — bonus columns excluded.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'support', 'finance', 'risk', 'reporting', 'marketing', 'kyc_agent']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) return res.status(403).json({ error: 'Forbidden' })

  const { data, error } = await supabaseAdmin
    .from('player_levels')
    .select([
      'id', 'name', 'sort_order', 'xp_required',
      'accent_color', 'badge_color', 'badge_icon',
      'kyc_required', 'is_active', 'description',
      'max_redeem_cap_cents', 'min_redeem_multiplier', 'max_redeem_multiplier',
      'min_withdrawal_cents', 'max_withdrawal_cents',
      'created_at',
    ].join(', '))
    .order('sort_order', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ levels: data || [] })
}
