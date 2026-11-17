/**
 * POST /api/admin/deposits/action
 * Approve or reject a deposit.
 *
 * Approval runs inside the approve_deposit_atomic() database function, so the
 * wallet credit, the cash/bonus ledger rows, any deposit-type promo, and the
 * referral payout all commit or roll back as ONE transaction. A failure can no
 * longer leave the wallet credited with no ledger row (or vice versa).
 *
 * Tenant isolation is enforced here: loadOwnedRow confirms the deposit belongs
 * to the caller's casino before the function is called by id.
 */
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.DEPOSITS_ACTION })
  if (!gate) return

  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { deposit_id, rejection_reason, notes } = req.body

  const ACTIONS = {
    approve: 'approved', approved: 'approved',
    reject: 'rejected',  rejected: 'rejected',
    under_review: 'under_review',
  }
  const action = ACTIONS[req.body?.action]

  if (!deposit_id || !req.body?.action) return res.status(400).json({ error: 'deposit_id and action required' })
  if (!action) return res.status(400).json({ error: 'Invalid action' })

  const reason = (rejection_reason ?? notes ?? '').trim()
  if (action === 'rejected' && !reason)
    return res.status(400).json({ error: 'Rejection reason is required' })

  // Load deposit — only if it belongs to the caller's casino.
  const { row: deposit, error: depErr } = await loadOwnedRow(gate, 'deposits', deposit_id)
  if (depErr || !deposit) return res.status(404).json({ error: 'Deposit not found' })

  const tenantId = tenantOf(deposit, gate)
  if (!['pending', 'under_review'].includes(deposit.status))
    return res.status(409).json({ error: `Deposit is already ${deposit.status}` })

  // ── Under review — just update status ─────────────────────
  if (action === 'under_review') {
    await supabaseAdmin.from('deposits').update({
      status: 'under_review',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', deposit_id)

    await logAudit(supabaseAdmin, admin, 'deposit_marked_under_review', 'deposit', deposit_id, deposit, { status: 'under_review' }, tenantId)
    return res.status(200).json({ message: 'Marked under review' })
  }

  // ── Reject ─────────────────────────────────────────────────
  // A deposit is credited only on approval, so a rejection moves no money —
  // just record the status and tell the player.
  if (action === 'rejected') {
    await supabaseAdmin.from('deposits').update({
      status: 'rejected',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    }).eq('id', deposit_id)

    await supabaseAdmin.from('notifications').insert({
      tenant_id: tenantId,
      user_id: deposit.user_id,
      type: 'deposit_rejected',
      title: 'Deposit Rejected',
      message: `Your deposit ${deposit.reference_id} was rejected. Reason: ${reason}`,
      reference_id: deposit.reference_id,
    })

    await logAudit(supabaseAdmin, admin, 'deposit_rejected', 'deposit', deposit_id, deposit, { status: 'rejected', rejection_reason: reason }, tenantId)
    return res.status(200).json({ message: 'Deposit rejected' })
  }

  // ── Approve — one atomic DB transaction ────────────────────
  // approve_deposit_atomic does the wallet credit, cash/bonus ledger rows, the
  // recomputed-and-capped deposit promo, and the same-tenant referral payout
  // together under row locks. If any part fails, none of it persists.
  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('approve_deposit_atomic', {
    p_deposit_id: deposit_id,
    p_admin_id:   admin.id,
  })
  if (rpcErr) return res.status(400).json({ error: rpcErr.message })

  // ── Best-effort side-effects — never roll back committed money ──
  // Player XP (updates profiles.total_xp + xp_history). The deposit's own
  // xp_earned was already stamped inside the transaction.
  const xpEarned = Math.floor(deposit.amount_cents / 100)
  await Promise.resolve(
    supabaseAdmin.rpc('increment_player_xp', { p_user_id: deposit.user_id, p_xp: xpEarned })
  ).then(() => {}, () => {})

  const promoCredited = result?.promo_cents || 0

  await supabaseAdmin.from('notifications').insert({
    tenant_id:    tenantId,
    user_id:      deposit.user_id,
    type:         'deposit_approved',
    title:        'Deposit Approved! 🎉',
    message:      `Your deposit of $${(deposit.amount_cents / 100).toFixed(2)} (${deposit.reference_id}) has been approved. ${(deposit.bonus_cents + promoCredited) > 0 ? `+$${((deposit.bonus_cents + promoCredited) / 100).toFixed(2)} bonus added!` : ''} Your wallet has been credited.`,
    reference_id: deposit.reference_id,
  }).then(() => {}, () => {})

  // Referrer notification, only if the atomic function actually paid one.
  if (result?.referral?.referrer_id) {
    await supabaseAdmin.from('notifications').insert({
      tenant_id: tenantId,
      user_id:   result.referral.referrer_id,
      type:      'bonus',
      title:     '🎉 Referral Bonus Earned!',
      message:   `You earned $${((result.referral.bonus_cents || 0) / 100).toFixed(2)} from your referral's deposit #${result.referral.deposit_number}.`,
    }).then(() => {}, () => {})
  }

  await logAudit(supabaseAdmin, admin, 'deposit_approved', 'deposit', deposit_id,
    { status: deposit.status },
    { status: 'approved', amount_cents: deposit.amount_cents, bonus_cents: deposit.bonus_cents, promo_cents: promoCredited },
    tenantId
  )

  return res.status(200).json({
    message: 'Deposit approved and wallet credited',
    credited: {
      cash_cents:  deposit.amount_cents,
      bonus_cents: deposit.bonus_cents,
      promo_cents: promoCredited,
      total_cents: deposit.total_credit_cents,
    },
  })
}

async function logAudit(client, actor, action, targetType, targetId, before, after, tenantId) {
  await client.from('audit_logs').insert({
    tenant_id:   tenantId,
    actor_id:    actor.id,
    actor_role:  actor.role,
    action,
    target_type: targetType,
    target_id:   targetId,
    before_state: before,
    after_state:  after,
  }).then(() => {}, () => {})
}
