/**
 * POST /api/admin/withdrawals/action
 * Approve (pay), reject, or move-to-processing a Withdraw request.
 *
 * The money movement runs inside withdrawal_action_atomic():
 *   approve → releases the reserve, reduces withdrawable, records the payout
 *   reject  → returns the held cash AND bonus to their buckets, with a ledger row
 *   processing → status only, no money
 * All of it commits or rolls back as one transaction with row locks. The cash
 * already left the wallet when the player requested (reserve_withdrawal), so
 * approval never debits cash again.
 *
 * Tenant isolation is enforced here (loadOwnedRow). Daily-limit validation is a
 * read done here before the atomic call.
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.WITHDRAWALS_ACTION })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor

  const { withdrawal_id, action, rejection_reason, notes, proof_screenshot_url } = req.body
  const reason = (rejection_reason ?? notes ?? '').trim()
  if (!withdrawal_id) return res.status(400).json({ error: 'withdrawal_id required' })
  if (!['approve', 'reject', 'processing'].includes(action))
    return res.status(400).json({ error: 'action must be approve, reject or processing' })

  const { row: withdrawal, error: wErr } = await loadOwnedRow(gate, 'withdrawals', withdrawal_id)
  if (wErr || !withdrawal) return res.status(404).json({ error: 'Withdraw not found' })
  const tenantId    = tenantOf(withdrawal, gate)
  const playerId    = withdrawal.user_id
  const amountCents = withdrawal.amount_cents

  const allowedFrom = {
    processing: ['pending', 'under_review'],
    approve:    ['pending', 'under_review', 'processing'],
    reject:     ['pending', 'under_review', 'processing'],
  }
  if (!allowedFrom[action].includes(withdrawal.status))
    return res.status(409).json({ error: `Withdraw is already ${withdrawal.status}` })
  if (action === 'reject' && !reason)
    return res.status(400).json({ error: 'A rejection reason is required.' })

  // ── Daily withdrawal limit — read-only validation, approve only ──
  let levelId = null, levelName = 'Bronze', levelDailyLimit = 50000, limitEnabled = true
  if (action === 'approve') {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('player_level_id, player_levels(id, name, daily_withdrawal_limit_cents)')
      .eq('id', playerId).single()
    levelId         = profile?.player_level_id ?? null
    levelName       = profile?.player_levels?.name || 'Bronze'
    levelDailyLimit = profile?.player_levels?.daily_withdrawal_limit_cents || 50000

    const { data: limitSetting } = await scopeToTenant(
      supabaseAdmin.from('platform_settings').select('value').eq('key', 'withdrawal_daily_limit_enabled'),
      gate,
    ).maybeSingle()
    limitEnabled = limitSetting?.value !== false && limitSetting?.value !== 'false'

    if (limitEnabled) {
      const { data: dailyTotal } = await supabaseAdmin.rpc('get_daily_withdrawn_cents', { p_user_id: playerId })
      if ((dailyTotal || 0) + amountCents > levelDailyLimit) {
        return res.status(422).json({
          error: `Daily withdrawal limit exceeded. Limit: $${(levelDailyLimit / 100).toFixed(2)} (${levelName}), Used: $${((dailyTotal || 0) / 100).toFixed(2)}, Requested: $${(amountCents / 100).toFixed(2)}`,
          code:  'DAILY_LIMIT_EXCEEDED',
        })
      }
    }
  }

  // ── Atomic money movement ──
  const snapshot = action === 'approve' ? {
    level_id: levelId, level_name: levelName, daily_limit_cents: levelDailyLimit,
    limit_enabled: limitEnabled, approved_by: actor.full_name, approved_at: new Date().toISOString(),
  } : null

  const { error: rpcErr } = await supabaseAdmin.rpc('withdrawal_action_atomic', {
    p_id:        withdrawal_id,
    p_action:    action,
    p_reason:    reason || null,
    p_admin:     actor.id,
    p_reference: null,
    p_proof:     proof_screenshot_url || null,
    p_level_id:  (action === 'approve' && Number.isInteger(levelId)) ? levelId : null,
    p_snapshot:  snapshot,
  })
  if (rpcErr) return res.status(400).json({ error: rpcErr.message })

  // ── Best-effort: daily tracking cache, notification, audit ──
  if (action === 'approve') {
    await supabaseAdmin.from('daily_withdrawal_tracking').upsert({
      user_id:              playerId,
      window_start:         new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      withdrawn_cents:      amountCents,
      level_id_snapshot:    levelId,
      daily_limit_snapshot: levelDailyLimit,
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'user_id' }).then(() => {}, () => {})
  }

  const notif = {
    processing: ['Withdraw Processing', `Your withdrawal ${withdrawal.reference_id} is now being processed. You will be notified once it is paid.`],
    approve:    ['Withdraw Paid', `Your withdrawal ${withdrawal.reference_id} of $${(amountCents / 100).toFixed(2)} has been paid.`],
    reject:     ['Withdraw Rejected', `Your withdrawal ${withdrawal.reference_id} was rejected. Reason: ${reason}`],
  }[action]
  await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId, user_id: playerId, type: 'general',
    title: notif[0], message: notif[1], reference_id: withdrawal.reference_id,
  }).then(() => {}, () => {})

  const auditAction = { approve: 'withdrawal_approved', reject: 'withdrawal_rejected', processing: 'withdrawal_processing' }[action]
  await supabaseAdmin.from('audit_logs').insert({
    tenant_id: tenantId, actor_id: actor.id, actor_role: actor.role,
    action: auditAction, target_type: 'withdrawal', target_id: withdrawal_id,
    description: `Withdraw ${withdrawal.reference_id} — $${(amountCents / 100).toFixed(2)} (${action})`,
    reason: reason || null,
  }).then(() => {}, () => {})

  const statusOut = { processing: 'processing', approve: 'paid', reject: 'rejected' }[action]
  return res.status(200).json({ ok: true, status: statusOut, amount_cents: amountCents })
}
