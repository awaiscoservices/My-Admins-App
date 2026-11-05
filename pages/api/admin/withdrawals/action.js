/**
 * POST /api/admin/withdrawals/action
 * Approve or reject a withdrawal.
 * Approve: debit withdrawable_cents + reserved_cents.
 * Reject: release reserved_cents back to cash + withdrawable.
 * Roles: super_admin, finance
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: admin } = await supabaseAdmin
    .from('profiles').select('id, role, full_name').eq('id', user.id).single()

  if (!admin || !['super_admin', 'finance'].includes(admin.role))
    return res.status(403).json({ error: 'Insufficient permissions. Finance role required.' })

  const { withdrawal_id, action, reason } = req.body

  if (!withdrawal_id || !['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'withdrawal_id and action required' })
  if (action === 'reject' && !reason?.trim())
    return res.status(400).json({ error: 'Reason required for rejection' })

  const { data: withdrawal } = await supabaseAdmin
    .from('withdrawals').select('*').eq('id', withdrawal_id).single()

  if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' })
  if (withdrawal.status !== 'pending') return res.status(409).json({ error: `Already ${withdrawal.status}` })

  const playerId    = withdrawal.user_id
  const amtCents    = withdrawal.amount_cents
  const method      = withdrawal.method || 'Unknown'
  const destination = withdrawal.destination || ''

  const { data: wallet } = await supabaseAdmin
    .from('wallets').select('*').eq('user_id', playerId).single()

  if (!wallet) return res.status(404).json({ error: 'Player wallet not found' })

  if (action === 'reject') {
    // Release reserved → return to cash + withdrawable
    const newReserved     = Math.max(0, (wallet.reserved_cents || 0) - amtCents)
    const newCash         = (wallet.cash_balance_cents || 0) + amtCents
    const newWithdrawable = (wallet.withdrawable_cents  || 0) + amtCents

    const { data: updatedWallet, error: updateErr } = await supabaseAdmin
      .from('wallets')
      .update({ reserved_cents: newReserved, cash_balance_cents: newCash, withdrawable_cents: newWithdrawable, version: wallet.version + 1 })
      .eq('id', wallet.id).eq('version', wallet.version)
      .select().single()

    if (updateErr || !updatedWallet)
      return res.status(409).json({ error: 'Wallet modified concurrently. Please retry.' })

    await supabaseAdmin.from('withdrawals').update({
      status: 'rejected', reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(), notes: reason,
    }).eq('id', withdrawal_id)

    await supabaseAdmin.from('ledger').insert({
      reference_id: `${withdrawal.reference_id}-REVERSAL`,
      user_id: playerId, type: 'withdrawal_reversal',
      wallet_bucket: 'cash', amount_cents: amtCents,
      direction: 'credit', balance_after_cents: newCash,
      description: `Withdrawal rejected — funds returned. Reason: ${reason}`,
      created_by: admin.id,
      idempotency_key: `wd_reject_${withdrawal_id}`,
    })

    await supabaseAdmin.from('notifications').insert({
      user_id: playerId, type: 'general',
      title: 'Withdrawal Rejected',
      message: `Your withdrawal of $${(amtCents / 100).toFixed(2)} via ${method} was rejected. Funds returned to your wallet. Reason: ${reason}`,
    })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id, actor_role: admin.role,
      action: 'withdrawal_rejected',
      target_type: 'withdrawal', target_id: withdrawal_id,
      before_state: { status: 'pending' }, after_state: { status: 'rejected' }, reason,
    }).catch(() => {})

    return res.status(200).json({ message: 'Withdrawal rejected, funds returned to player' })
  }

  // APPROVE — debit withdrawable
  if ((wallet.withdrawable_cents || 0) < amtCents)
    return res.status(400).json({ error: `Insufficient withdrawable balance. Has: $${((wallet.withdrawable_cents||0)/100).toFixed(2)}, needs: $${(amtCents/100).toFixed(2)}` })

  const newWithdrawable = wallet.withdrawable_cents - amtCents
  const newReserved     = Math.max(0, (wallet.reserved_cents || 0) - amtCents)

  const { data: updatedWallet, error: updateErr } = await supabaseAdmin
    .from('wallets')
    .update({ withdrawable_cents: newWithdrawable, reserved_cents: newReserved, version: wallet.version + 1 })
    .eq('id', wallet.id).eq('version', wallet.version)
    .select().single()

  if (updateErr || !updatedWallet)
    return res.status(409).json({ error: 'Wallet modified concurrently. Please retry.' })

  await supabaseAdmin.from('withdrawals').update({
    status: 'approved', reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', withdrawal_id)

  await supabaseAdmin.from('ledger').insert({
    reference_id: `${withdrawal.reference_id}-DEBIT`,
    user_id: playerId, type: 'withdrawal',
    wallet_bucket: 'cash', amount_cents: amtCents,
    direction: 'debit', balance_after_cents: newWithdrawable,
    description: `Withdrawal approved via ${method}${destination ? ` to ${destination}` : ''}`,
    created_by: admin.id,
    idempotency_key: `wd_approve_${withdrawal_id}`,
  })

  await supabaseAdmin.from('notifications').insert({
    user_id: playerId, type: 'general',
    title: 'Withdrawal Approved ✅',
    message: `Your withdrawal of $${(amtCents / 100).toFixed(2)} via ${method} is approved. Allow 1–3 business days.`,
    reference_id: withdrawal.reference_id,
  })

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id, actor_role: admin.role,
    action: 'withdrawal_approved',
    target_type: 'withdrawal', target_id: withdrawal_id,
    before_state: { status: 'pending', withdrawable_cents: wallet.withdrawable_cents },
    after_state: { status: 'approved', withdrawable_cents: newWithdrawable },
  }).catch(() => {})

  return res.status(200).json({ message: 'Withdrawal approved successfully' })
}
