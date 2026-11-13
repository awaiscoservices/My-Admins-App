/**
 * pages/api/admin/bonuses/bonus-config.js
 *
 * The universal Bonus Balance settings — ONE global row, shared by every
 * casino (not tenant-scoped). Controls how bonus-funded scores redeem.
 *
 *   GET  → { config: { redeemable_pct } }
 *   PUT  { redeemable_pct } → upsert the single row
 *
 * Bonus-funded winnings always redeem at a flat %, never a multiplier.
 *
 * Admin-only (BONUSES_WRITE). Because it is universal, a change here applies
 * to all tenants at once.
 */
import { guardAdmin, PERMS } from '../../../../lib/adminGuard'

// Single-row table keyed by a constant `true` id (see the SQL that creates it).
const ROW_ID = true

export default async function handler(req, res) {
  const needRead = req.method === 'GET'
  const gate = await guardAdmin(req, res, { allow: needRead ? PERMS.BONUSES_READ : PERMS.BONUSES_WRITE })
  if (!gate) return
  const admin = gate.db

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('bonus_balance_config')
      .select('redeemable_pct')
      .eq('id', ROW_ID)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({
      config: data ?? { redeemable_pct: 10 },
    })
  }

  if (req.method === 'PUT') {
    const { redeemable_pct } = req.body ?? {}
    const pct = parseFloat(redeemable_pct)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'redeemable_pct must be 0–100' })
    }
    const { data, error } = await admin
      .from('bonus_balance_config')
      .upsert(
        { id: ROW_ID, redeemable_pct: pct, updated_by: gate.actor.id, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select('redeemable_pct')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, config: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
