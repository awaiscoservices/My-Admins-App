/**
 * pages/api/admin/bonuses/list.js
 *
 * GET → returns all data the Player Bonuses admin page needs:
 *   { paymentMethods, levels, bonuses, referralTiers }
 *
 * paymentMethods now includes allow_deposit + allow_withdraw flags.
 * Admin-only (service-role key, server-side only).
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.BONUSES_READ })
  if (!gate) return
  const admin = gate.db

  // ── Fetch in parallel ─────────────────────────────────────────────────────
  // Scoped: these four tables are per-casino config and player bonuses.
  const sq = (table, select) => scopeToTenant(admin.from(table).select(select), gate)

  const [pmRes, levelRes, bonusRes, referralRes] = await Promise.all([
    sq('payment_methods', 'id, name, type, description, is_active, sort_order, allow_deposit, allow_withdraw')
      .order('sort_order', { ascending: true }),

    sq('player_levels', 'id, name, sort_order, accent_color, xp_required')
      .order('sort_order', { ascending: true }),

    sq('player_bonuses', 'id, payment_method_id, player_level_id, day_number, bonus_percent'),

    sq('referral_bonus_tiers', 'id, deposit_number, bonus_percent, is_active')
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
