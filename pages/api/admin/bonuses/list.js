/**
 * pages/api/admin/bonuses/list.js
 *
 * GET → returns all data the Player Bonuses admin page needs:
 *   { paymentMethods, levels, bonuses, referralTiers }
 *
 * paymentMethods now includes allow_deposit + allow_withdraw flags.
 * Admin-only (service-role key, server-side only).
 */
import { createClient } from '@supabase/supabase-js'
import { createPagesServerClient } from '../../../../lib/supabaseServer'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabaseUser = createPagesServerClient({ req, res })
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('is_staff')
    .eq('id', user.id)
    .single()

  if (!profile?.is_staff) return res.status(403).json({ error: 'Forbidden' })

  // ── Fetch in parallel ─────────────────────────────────────────────────────
  const [pmRes, levelRes, bonusRes, referralRes] = await Promise.all([
    admin
      .from('payment_methods')
      .select('id, name, type, description, is_active, sort_order, allow_deposit, allow_withdraw')
      .order('sort_order', { ascending: true }),

    admin
      .from('player_levels')
      .select('id, name, sort_order, accent_color, xp_required')
      .order('sort_order', { ascending: true }),

    admin
      .from('player_bonuses')
      .select('id, payment_method_id, player_level_id, day_number, bonus_percent'),

    admin
      .from('referral_bonus_tiers')
      .select('id, deposit_number, bonus_percent, is_active')
      .order('deposit_number', { ascending: true }),
  ])

  // Surface any DB errors
  for (const r of [pmRes, levelRes, bonusRes, referralRes]) {
    if (r.error) {
      console.error('[bonuses/list]', r.error)
      return res.status(500).json({ error: r.error.message })
    }
  }

  return res.status(200).json({
    paymentMethods: pmRes.data    || [],
    levels:         levelRes.data || [],
    bonuses:        bonusRes.data || [],
    referralTiers:  referralRes.data || [],
  })
}
