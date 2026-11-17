/**
 * POST /api/admin/deposits/action
 * Approve or reject a deposit.
 * On approval: creates ledger entries + updates wallet balance.
 * All financial math is server-side only.
 */
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verifies the token, checks the role, and resolves the caller's casino.
  const gate = await guardAdmin(req, res, { allow: PERMS.DEPOSITS_ACTION })
  if (!gate) return

  const supabaseAdmin = gate.db
  const actor = gate.actor
  const admin = gate.actor

  const { deposit_id, rejection_reason, notes } = req.body

  // Every admin page sends approve/reject, and the other four action routes
  // take exactly that. This one alone demanded the past tense and answered
  // "Invalid action" to the button on its own page. Both are accepted, and
  // the past tense is what gets stored, because it is the deposit's status.
  const ACTIONS = {
    approve: 'approved', approved: 'approved',
    reject: 'rejected',  rejected: 'rejected',
    under_review: 'under_review',
  }
  const action = ACTIONS[req.body?.action]

  if (!deposit_id || !req.body?.action) return res.status(400).json({ error: 'deposit_id and action required' })
  if (!action) return res.status(400).json({ error: 'Invalid action' })

  // The page calls this field notes; this route called it rejection_reason,
  // so a rejection would have failed on the next line even once the action
  // was accepted.
  const reason = (rejection_reason ?? notes ?? '').trim()
  if (action === 'rejected' && !reason)
    return res.status(400).json({ error: 'Rejection reason is required' })

  // ── Load deposit — only if it belongs to the caller's casino ───
  // This single filter secures the whole route: everything below works from
  // `deposit`, so another casino's deposit is simply not found.
  const { row: deposit, error: depErr } = await loadOwnedRow(gate, 'deposits', deposit_id)

  if (depErr || !deposit) return res.status(404).json({ error: 'Deposit not found' })

  // Stamp child rows (ledger, notifications) with the same casino.
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
  if (action === 'rejected') {
    await supabaseAdmin.from('deposits').update({
      status: 'rejected',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    }).eq('id', deposit_id)

    // Notify player
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

  // ── Approve — create ledger entries + update wallet ────────
  // Load current wallet with version for optimistic lock
  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', deposit.user_id)
    .single()

  if (walletErr || !wallet) return res.status(500).json({ error: 'Wallet not found' })

  const newCashBalance = wallet.cash_balance_cents + deposit.amount_cents
  const newBonusBalance = wallet.bonus_balance_cents + deposit.bonus_cents
  const newWithdrawable = wallet.withdrawable_cents + deposit.amount_cents
  const newTotalDeposited = wallet.total_deposited_cents + deposit.amount_cents
  const newTotalBonus = wallet.total_bonus_cents + deposit.bonus_cents

  // Update wallet with optimistic lock (version check)
  const { data: updatedWallet, error: updateErr } = await supabaseAdmin
    .from('wallets')
    .update({
      cash_balance_cents:    newCashBalance,
      bonus_balance_cents:   newBonusBalance,
      withdrawable_cents:    newWithdrawable,
      total_deposited_cents: newTotalDeposited,
      total_bonus_cents:     newTotalBonus,
      version:               wallet.version + 1,
    })
    .eq('id', wallet.id)
    .eq('version', wallet.version) // optimistic lock
    .select()
    .single()

  if (updateErr || !updatedWallet) {
    return res.status(409).json({ error: 'Wallet was modified concurrently. Please try again.' })
  }

  // Create ledger entry: deposit (cash)
  const depositLedgerRef = `${deposit.reference_id}-CASH`
  await supabaseAdmin.from('ledger').insert({
    tenant_id:           tenantId,
    reference_id:        depositLedgerRef,
    user_id:             deposit.user_id,
    type:                'deposit',
    wallet_bucket:       'cash',
    amount_cents:        deposit.amount_cents,
    direction:           'credit',
    balance_after_cents: newCashBalance,
    deposit_id:          deposit.id,
    description:         `Deposit approved via ${deposit.reference_id}`,
    created_by:          admin.id,
    idempotency_key:     `${deposit.id}-cash-credit`,
  })

  // Create ledger entry: bonus (if any)
  if (deposit.bonus_cents > 0) {
    const bonusLedgerRef = `${deposit.reference_id}-BONUS`
    await supabaseAdmin.from('ledger').insert({
      tenant_id:           tenantId,
      reference_id:        bonusLedgerRef,
      user_id:             deposit.user_id,
      type:                'deposit_bonus',
      wallet_bucket:       'bonus',
      amount_cents:        deposit.bonus_cents,
      direction:           'credit',
      balance_after_cents: newBonusBalance,
      deposit_id:          deposit.id,
      description:         `${deposit.bonus_pct_applied}% deposit bonus for ${deposit.reference_id}`,
      created_by:          admin.id,
      idempotency_key:     `${deposit.id}-bonus-credit`,
    })
  }

  // ── Promo code bonus (deposit-type) ───────────────────────
  // Separate from the method/level bonus above; also lands in the Bonus
  // bucket. Recomputed from the promo so a stale snapshot can't over-credit.
  let promoCredited = 0
  if (deposit.promotion_id) {
    const { data: promo } = await supabaseAdmin
      .from('promotions')
      .select('id, code, type, bonus_value, max_bonus_cents, current_uses')
      .eq('id', deposit.promotion_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (promo && promo.type === 'deposit') {
      let promoBonus = Math.floor(deposit.amount_cents * (Number(promo.bonus_value || 0) / 100))
      if (promo.max_bonus_cents != null) promoBonus = Math.min(promoBonus, promo.max_bonus_cents)

      if (promoBonus > 0) {
        const bonusAfter = updatedWallet.bonus_balance_cents + promoBonus
        const { data: w2 } = await supabaseAdmin.from('wallets')
          .update({
            bonus_balance_cents: bonusAfter,
            total_bonus_cents:   updatedWallet.total_bonus_cents + promoBonus,
            version:             updatedWallet.version + 1,
          })
          .eq('id', updatedWallet.id).eq('version', updatedWallet.version)
          .select().single()

        if (w2) {
          promoCredited = promoBonus
          updatedWallet.bonus_balance_cents = w2.bonus_balance_cents
          updatedWallet.total_bonus_cents   = w2.total_bonus_cents
          updatedWallet.version             = w2.version

          await supabaseAdmin.from('ledger').insert({
            tenant_id:           tenantId,
            reference_id:        `${deposit.reference_id}-PROMO`,
            user_id:             deposit.user_id,
            type:                'promotion_credit',
            wallet_bucket:       'bonus',
            amount_cents:        promoBonus,
            direction:           'credit',
            balance_after_cents: bonusAfter,
            deposit_id:          deposit.id,
            description:         `Promo ${promo.code} bonus for ${deposit.reference_id}`,
            created_by:          admin.id,
            idempotency_key:     `${deposit.id}-promo-credit`,
            metadata:            { promo_id: promo.id, code: promo.code },
          }).then(() => {}, () => {})

          await supabaseAdmin.from('promo_redemptions').insert({
            tenant_id: tenantId, promotion_id: promo.id, user_id: deposit.user_id,
            deposit_id: deposit.id, kind: 'deposit', bonus_cents: promoBonus,
          }).then(() => {}, () => {})

          await supabaseAdmin.from('promotions')
            .update({ current_uses: (promo.current_uses || 0) + 1 })
            .eq('id', promo.id).then(() => {}, () => {})
        }
      }
    }
  }

  // Update deposit status
  await supabaseAdmin.from('deposits').update({
    status:      'approved',
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
    xp_earned:   Math.floor(deposit.amount_cents / 100), // 1 XP per dollar
  }).eq('id', deposit_id)

  // Award XP to player (non-critical: never blocks the approval)
  const xpEarned = Math.floor(deposit.amount_cents / 100)
  await Promise.resolve(
    supabaseAdmin.rpc('increment_player_xp', { p_user_id: deposit.user_id, p_xp: xpEarned })
  ).then(() => {}, () => {})

  // Referral bonus — credit referrer on referee's 1st/2nd/3rd approved deposit
  // Non-critical: runs async, never blocks the approval response
  triggerReferralBonus(supabaseAdmin, deposit.user_id, deposit.id, deposit.amount_cents, tenantId)
    .catch(err => console.error('[deposits/action] referral bonus error:', err))

  // Notify player
  await supabaseAdmin.from('notifications').insert({
    tenant_id:    tenantId,
    user_id:      deposit.user_id,
    type:         'deposit_approved',
    title:        'Deposit Approved! 🎉',
    message:      `Your deposit of $${(deposit.amount_cents / 100).toFixed(2)} (${deposit.reference_id}) has been approved. ${(deposit.bonus_cents + promoCredited) > 0 ? `+$${((deposit.bonus_cents + promoCredited) / 100).toFixed(2)} bonus added!` : ''} Your wallet has been credited.`,
    reference_id: deposit.reference_id,
  })

  await logAudit(supabaseAdmin, admin, 'deposit_approved', 'deposit', deposit_id,
    { status: deposit.status },
    { status: 'approved', amount_cents: deposit.amount_cents, bonus_cents: deposit.bonus_cents },
    tenantId
  )

  return res.status(200).json({
    message: 'Deposit approved and wallet credited',
    credited: {
      cash_cents:  deposit.amount_cents,
      bonus_cents: deposit.bonus_cents,
      total_cents: deposit.total_credit_cents,
    },
  })
}

// ── Referral bonus on deposit approval ───────────────────────────────────────
// Credits the referrer a % of the referee's deposit amount based on
// referral_bonus_tiers (deposit_number 1, 2, 3).
async function triggerReferralBonus(client, userId, depositId, amountCents, tenantId) {
  // Find referral row where this user is the referee
  const { data: referral } = await client
    .from('referrals')
    .select('id, referrer_id, reward_status, is_flagged')
    .eq('referred_id', userId)
    .eq('reward_status', 'pending')
    .eq('is_flagged', false)
    .single()

  if (!referral) return

  // Count how many approved deposits this user now has (including this one)
  const { count } = await client
    .from('deposits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'approved')

  const depositNumber = count || 1

  // Only pay out on deposit 1, 2, or 3
  if (depositNumber > 3) return

  // This casino's tier. Unscoped, another casino's percentage could decide
  // what this one pays out.
  const { data: tier } = await client
    .from('referral_bonus_tiers')
    .select('bonus_percent')
    .eq('deposit_number', depositNumber)
    .eq('is_active', true)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!tier) return

  const bonusCents = Math.floor(amountCents * (parseFloat(tier.bonus_percent) / 100))
  if (bonusCents <= 0) return

  // The referrer must belong to the same casino as this deposit. Service role
  // bypasses RLS, and the tenant on the ledger row below is taken from the
  // referee's deposit — paying a referrer from another tenant would move money
  // across casino boundaries. Refuse rather than pay.
  const { data: refProfile } = await client
    .from('profiles').select('tenant_id').eq('id', referral.referrer_id).maybeSingle()
  if (!refProfile || refProfile.tenant_id !== tenantId) {
    console.warn(`[deposits/action] referral ${referral.id}: referrer tenant mismatch — skipped`)
    return
  }

  // Credit referrer's cash balance with an optimistic version lock, so a
  // concurrent wallet change can't be clobbered by a stale read-modify-write.
  const { data: rw } = await client
    .from('wallets')
    .select('cash_balance_cents, total_bonus_cents, version')
    .eq('user_id', referral.referrer_id)
    .single()

  if (!rw) return

  const referrerCashAfter = rw.cash_balance_cents + bonusCents
  const { data: updatedRw } = await client.from('wallets').update({
    cash_balance_cents: referrerCashAfter,
    total_bonus_cents:  rw.total_bonus_cents  + bonusCents,
    updated_at:         new Date().toISOString(),
    version:            (rw.version || 0) + 1,
  }).eq('user_id', referral.referrer_id).eq('version', rw.version).select().maybeSingle()

  // Lost the race — another write touched the wallet first. Skip the ledger
  // and tracking rather than record a credit that did not land.
  if (!updatedRw) {
    console.warn(`[deposits/action] referral ${referral.id}: referrer wallet changed concurrently — skipped`)
    return
  }

  // Ledger entry for referrer — bucket/direction/balance_after so it renders
  // in the player's Transactions like any other movement.
  await client.from('ledger').insert({
    tenant_id:           tenantId,
    user_id:             referral.referrer_id,
    type:                'referral_bonus',
    wallet_bucket:       'cash',
    amount_cents:        bonusCents,
    direction:           'credit',
    balance_after_cents: referrerCashAfter,
    description:         `Referral bonus from deposit #${depositNumber}`,
    entity:       'referrals',
    entity_id:    referral.id,
    metadata: {
      referred_id:    userId,
      deposit_id:     depositId,
      deposit_number: depositNumber,
      deposit_cents:  amountCents,
      bonus_percent:  tier.bonus_percent,
    },
  }).then(() => {}, () => {})

  // Update referral reward tracking
  await client.from('referrals').update({
    reward_cents:  (referral.reward_cents || 0) + bonusCents,
    reward_status: depositNumber >= 3 ? 'paid' : 'pending',
    reward_paid_at: depositNumber >= 3 ? new Date().toISOString() : null,
  }).eq('id', referral.id).then(() => {}, () => {})

  // Notify referrer
  await client.from('notifications').insert({
    tenant_id: tenantId,
    user_id: referral.referrer_id,
    type:    'bonus',
    title:   '🎉 Referral Bonus Earned!',
    message: `You earned $${(bonusCents / 100).toFixed(2)} from your referral's deposit #${depositNumber}.`,
  }).then(() => {}, () => {})
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
