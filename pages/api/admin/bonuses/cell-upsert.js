/**
 * pages/api/admin/bonuses/cell-upsert.js
 *
 * POST { payment_method_id, player_level_id, day_number, bonus_percent }
 *   bonus_percent null → delete the row (no bonus)
 *   bonus_percent 0–100 → upsert
 *
 * Admin-only.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.BONUSES_WRITE })
  if (!gate) return
  const admin = gate.db

  const { payment_method_id, player_level_id, day_number, bonus_percent } = req.body

  if (!payment_method_id || !player_level_id || !day_number) {
    return res.status(400).json({ error: 'payment_method_id, player_level_id, day_number required' })
  }

  if (bonus_percent === null || bonus_percent === undefined) {
    // Delete: clear the bonus for this cell
    const { error } = await admin
      .from('player_bonuses')
      .delete()
      .eq('payment_method_id', payment_method_id)
      .eq('player_level_id', player_level_id)
      .eq('day_number', day_number)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, action: 'deleted' })
  }

  const pct = parseFloat(bonus_percent)
  if (isNaN(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'bonus_percent must be 0–100' })
  }

  // Build a name for the row
  const { data: pm } = await admin.from('payment_methods').select('name').eq('id', payment_method_id).single()
  const { data: lv } = await admin.from('player_levels').select('name').eq('id', player_level_id).single()
  const name = `${pm?.name || payment_method_id} - ${lv?.name || player_level_id} - Day ${day_number}`

  const { error } = await admin
    .from('player_bonuses')
    .upsert(
      { payment_method_id, player_level_id, day_number, bonus_percent: pct, name },
      { onConflict: 'payment_method_id,player_level_id,day_number' }
    )

  if (error) {
    console.error('[cell-upsert]', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true, action: 'upserted' })
}
