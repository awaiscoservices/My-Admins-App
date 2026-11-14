/**
 * GET /api/admin/promo-codes/list
 * Promo campaigns for the caller's casino (code-based promos stored in
 * `promotions`). Each row carries how many times it has been redeemed.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.PROMOS_READ })
  if (!gate) return
  const db = gate.db

  const { data, error } = await scopeToTenant(
    db.from('promotions')
      .select('id, name, code, description, type, bonus_value, reward_cents, max_bonus_cents, min_deposit_cents, max_uses_per_player, max_uses_total, current_uses, starts_at, expires_at, is_active, created_at')
      .in('type', ['deposit', 'wallet'])
      .order('created_at', { ascending: false }),
    gate,
  )
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ rows: data || [] })
}
