/**
 * GET /api/admin/bonuses/list
 * Returns all player bonus tiers + referral tiers. Staff only.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'finance', 'marketing']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) return res.status(403).json({ error: 'Forbidden' })

  const [bonuses, referral, paymentMethods, levels] = await Promise.all([
    supabaseAdmin
      .from('player_bonuses')
      .select('*, payment_methods(id, name), player_levels(id, name)')
      .order('day_number')
      .order('created_at'),
    supabaseAdmin
      .from('referral_bonus_tiers')
      .select('*')
      .order('deposit_number'),
    supabaseAdmin.from('payment_methods').select('id, name').eq('is_active', true).order('name'),
    supabaseAdmin.from('player_levels').select('id, name').order('sort_order'),
  ])

  if (bonuses.error) return res.status(500).json({ error: bonuses.error.message })

  return res.status(200).json({
    bonuses: bonuses.data || [],
    referralTiers: referral.data || [],
    paymentMethods: paymentMethods.data || [],
    levels: levels.data || [],
  })
}
