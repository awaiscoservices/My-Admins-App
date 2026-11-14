/**
 * POST /api/admin/promo-codes/upsert
 * Create or update a promo campaign (code-based) for the caller's casino.
 *
 * Two kinds:
 *  - type 'deposit': a %age bonus applied to a deposit. bonus_value = percent,
 *    max_bonus_cents caps it, min_deposit_cents is the floor.
 *  - type 'wallet': a fixed amount claimed straight to the Bonus balance.
 *    reward_cents = the credit.
 * Either way the credit lands in the player's Bonus balance.
 */
import { guardAdmin, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.PROMOS_WRITE })
  if (!gate) return
  const db = gate.db
  const admin = gate.actor

  const {
    id, name, code, description, type,
    bonus_value, reward_cents, max_bonus_cents, min_deposit_cents,
    max_uses_per_player, max_uses_total, starts_at, expires_at, is_active,
  } = req.body

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
  const cleanCode = (code || '').trim().toUpperCase()
  if (!cleanCode) return res.status(400).json({ error: 'Promo code is required' })
  if (!/^[A-Z0-9]{3,24}$/.test(cleanCode)) return res.status(400).json({ error: 'Code must be 3–24 letters/numbers, no spaces' })
  if (!['deposit', 'wallet'].includes(type)) return res.status(400).json({ error: 'Type must be deposit or wallet' })

  if (type === 'deposit') {
    const pct = Number(bonus_value)
    if (!pct || pct <= 0 || pct > 100) return res.status(400).json({ error: 'Deposit promo needs a percent between 1 and 100' })
  } else {
    const amt = Number(reward_cents)
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Wallet promo needs a reward amount' })
  }

  // Code must be unique within the casino.
  const { data: clash } = await db.from('promotions')
    .select('id').eq('tenant_id', gate.tenantId).eq('code', cleanCode).maybeSingle()
  if (clash && clash.id !== id) return res.status(409).json({ error: 'That code is already in use' })

  const payload = {
    tenant_id: gate.tenantId,
    name: name.trim(),
    code: cleanCode,
    description: description?.trim() || null,
    type,
    bonus_type: type === 'deposit' ? 'percent' : 'fixed',
    bonus_value: type === 'deposit' ? Number(bonus_value) : null,
    reward_cents: type === 'wallet' ? Math.round(Number(reward_cents)) : null,
    max_bonus_cents: max_bonus_cents ? Math.round(Number(max_bonus_cents)) : null,
    min_deposit_cents: min_deposit_cents ? Math.round(Number(min_deposit_cents)) : null,
    max_uses_per_player: max_uses_per_player ? Math.round(Number(max_uses_per_player)) : null,
    max_uses_total: max_uses_total ? Math.round(Number(max_uses_total)) : null,
    starts_at: starts_at || null,
    expires_at: expires_at || null,
    is_active: is_active !== false,
    updated_at: new Date().toISOString(),
  }

  let promoId = id
  if (id) {
    const { error } = await db.from('promotions').update(payload).eq('id', id).eq('tenant_id', gate.tenantId)
    if (error) return res.status(500).json({ error: error.message })
  } else {
    const { data, error } = await db.from('promotions')
      .insert({ ...payload, current_uses: 0, created_by: admin.id, created_at: new Date().toISOString() })
      .select('id').single()
    if (error) return res.status(500).json({ error: error.message })
    promoId = data.id
  }

  await db.from('audit_logs').insert({
    tenant_id: gate.tenantId, actor_id: admin.id, actor_role: admin.role,
    action: id ? 'promo_code_update' : 'promo_code_create',
    target_type: 'promotion', target_id: promoId,
    description: `Promo ${cleanCode} (${type}) ${id ? 'updated' : 'created'}`,
    metadata: { code: cleanCode, type },
  }).then(() => {}, () => {})

  return res.status(200).json({ success: true, id: promoId })
}
