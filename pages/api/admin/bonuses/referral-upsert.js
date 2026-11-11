/**
 * POST /api/admin/bonuses/referral-upsert
 * Update referral bonus % for deposit 1, 2, or 3. super_admin / admin only.
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.BONUSES_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor

  const { deposit_number, bonus_percent, is_active } = req.body
  if (!deposit_number || deposit_number < 1 || deposit_number > 3) {
    return res.status(400).json({ error: 'deposit_number must be 1, 2, or 3' })
  }

  // Scoped: deposit_number is not unique across casinos, so an unscoped
  // update rewrote every casino's tier for that deposit number.
  const { error } = await scopeToTenant(
    supabaseAdmin
      .from('referral_bonus_tiers')
      .update({ bonus_percent: bonus_percent ?? 0, is_active: is_active ?? true, updated_at: new Date().toISOString() })
      .eq('deposit_number', deposit_number),
    gate,
  )

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('audit_logs').insert({
    tenant_id: gate.tenantId,
    action: 'referral_bonus_update',
    performed_by: user.id,
    target_type: 'referral_bonus_tier',
    target_id: String(deposit_number),
    details: { deposit_number, bonus_percent },
  })

  return res.status(200).json({ success: true })
}
