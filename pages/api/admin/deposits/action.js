/**
 * POST /api/admin/deposits/action
 * Approve or reject a deposit.
 * On approval: creates ledger entries + updates wallet balance.
 * All financial math is server-side only.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Auth: must be staff ────────────────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: admin } = await supabaseAdmin
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['super_admin', 'finance']
  if (!admin || !allowedRoles.includes(admin.role))
    return res.status(403).json({ error: 'Insufficient permissions' })

  const { deposit_id, action, rejection_reason } = req.body

  if (!deposit_id || !action) return res.status(400).json({ error: 'deposit_id and action required' })
  if (!['approved', 'rejected', 'under_review'].includes(action))
    return res.status(400).json({ error: 'Invalid action' })
  if (action === 'rejected' && !rejection_reason?.trim())
    return res.status(400).json({ error: 'Rejection reason is required' })

  // ── Load deposit ───────────────────────────────────────────
  const { data: deposit, error: depErr } = await supabaseAdmin
    .from('deposits')
    .select('*')
    .eq('id', deposit_id)
    .single()

  if (depErr || !deposit) return res.status(404).json({ error: 'Deposit not found' })
  if (!['pending', 'under_review'].includes(deposit.status))
    return res.status(409).json({ error: `Deposit is already ${deposit.status}` })

  // ── Under review — just update status ─────────────────────
  if (action === 'under_review') {
    await supabaseAdmin.from('deposits').update({
      status: 'under_review',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', deposit_id)

    await logAudit(supabaseAdmin, admin, 'deposit_marked_under_review', 'deposit', deposit_id, deposit, { status: 'under_review' })
    return res.status(200).json({ message: 'Marked under review' })
  }

  // ── Reject ─────────────────────────────────────────────────
  if (action === 'rejected') {
    await supabaseAdmin.from('deposits').update({
      status: 'rejected',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason,
    }).eq('id', deposit_id)

    // Notify player
    await supabaseAdmin.from('notifications').insert({
      user_id: deposit.user_id,
      type: 'deposit_rejected',
      title: 'Deposit Rejected',
      message: `Your deposit ${deposit.reference_id} was rejected. Reason: ${rejection_reason}`,
      reference_id: deposit.reference_id,
    })

    await logAudit(supabaseAdmin, admin, 'deposit_rejected', 'deposit', deposit_id, deposit, { status: 'rejected', rejection_reason })
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

  // Notify player
  await supabaseAdmin.from('notifications').insert({
    user_id:      deposit.user_id,
    type:         'deposit_approved',
    title:        'Deposit Approved! 🎉',
    message:      `Your deposit of $${(deposit.amount_cents / 100).toFixed(2)} (${deposit.reference_id}) has been approved. ${deposit.bonus_cents > 0 ? `+$${(deposit.bonus_cents / 100).toFixed(2)} bonus added!` : ''} Your wallet has been credited.`,
    reference_id: deposit.reference_id,
  })

  await logAudit(supabaseAdmin, admin, 'deposit_approved', 'deposit', deposit_id,
    { status: deposit.status },
    { status: 'approved', amount_cents: deposit.amount_cents, bonus_cents: deposit.bonus_cents }
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

async function logAudit(client, actor, action, targetType, targetId, before, after) {
  await client.from('audit_logs').insert({
    actor_id:    actor.id,
    actor_role:  actor.role,
    action,
    target_type: targetType,
    target_id:   targetId,
    before_state: before,
    after_state:  after,
  }).then(() => {}, () => {})
}
