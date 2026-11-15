/**
 * pages/api/admin/bonuses/signup-config.js
 *
 * Per-tenant Signup Bonus — a first-deposit bonus for brand-new players.
 * A player who has never deposited gets this % on their first deposit (it
 * overrides the normal per-method/level deposit bonus); after that, the
 * normal level bonuses apply. The % is the single source of truth, shown on
 * every payment method and the home banner on the player side.
 *
 *   GET → { config: { pct, is_active } }  (for the caller's tenant)
 *   PUT { pct, is_active } → upsert the tenant's row
 *
 * Admin-only (BONUSES_READ / BONUSES_WRITE), scoped to the caller's casino.
 */
import { guardAdmin, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  const needRead = req.method === 'GET'
  const gate = await guardAdmin(req, res, { allow: needRead ? PERMS.BONUSES_READ : PERMS.BONUSES_WRITE })
  if (!gate) return
  const admin = gate.db
  const tenantId = gate.tenantId

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('signup_bonus_config')
      .select('pct, is_active')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ config: data ?? { pct: 0, is_active: false } })
  }

  if (req.method === 'PUT') {
    const { pct, is_active } = req.body ?? {}
    const p = parseFloat(pct)
    if (isNaN(p) || p < 0 || p > 100) return res.status(400).json({ error: 'pct must be 0–100' })
    const { data, error } = await admin
      .from('signup_bonus_config')
      .upsert(
        { tenant_id: tenantId, pct: p, is_active: !!is_active, updated_by: gate.actor.id, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' }
      )
      .select('pct, is_active')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, config: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
