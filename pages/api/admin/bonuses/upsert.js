/**
 * POST /api/admin/bonuses/upsert
 * Create or update a player bonus tier. super_admin / admin only.
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.BONUSES_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor

  const {
    id,
    name,
    payment_method_id,
    player_level_id,
    day_number,
    min_deposit_cents,
    max_deposit_cents,
    bonus_percent,
    bonus_to_cash_percent,
    is_active,
  } = req.body

  if (!name || !day_number) return res.status(400).json({ error: 'name and day_number are required' })
  if (day_number < 1 || day_number > 7) return res.status(400).json({ error: 'day_number must be 1–7' })

  const payload = {
    tenant_id: gate.tenantId,
    name,
    payment_method_id: payment_method_id || null,
    player_level_id: player_level_id || null,
    day_number,
    min_deposit_cents: min_deposit_cents ?? 0,
    max_deposit_cents: max_deposit_cents ?? null,
    bonus_percent: bonus_percent ?? 0,
    bonus_to_cash_percent: bonus_to_cash_percent ?? 0,
    is_active: is_active ?? true,
    updated_at: new Date().toISOString(),
  }

  let result
  if (id) {
    result = await supabaseAdmin.from('player_bonuses').update(payload).eq('id', id).select('id').single()
  } else {
    result = await supabaseAdmin.from('player_bonuses').insert(payload).select('id').single()
  }

  if (result.error) return res.status(500).json({ error: result.error.message })

  await supabaseAdmin.from('audit_logs').insert({
    action: id ? 'bonus_tier_update' : 'bonus_tier_create',
    performed_by: user.id,
    target_type: 'player_bonus',
    target_id: result.data.id,
    details: { name, day_number, bonus_percent },
  })

  return res.status(200).json({ success: true, id: result.data.id })
}
