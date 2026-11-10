/**
 * POST /api/admin/players/adjust-wallet
 * Apply a manual wallet adjustment with full ledger entry + audit log.
 * Admin CANNOT set a balance directly — only adjust with a reason.
 */
import { guardAdmin, scopeToTenant, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PLAYER_WALLET_ADJUST })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { player_id, direction, wallet_bucket, amount_cents, reason, case_reference } = req.body

  // Validate
  if (!player_id) return res.status(400).json({ error: 'player_id required' })
  if (!['credit', 'debit'].includes(direction)) return res.status(400).json({ error: 'Invalid direction' })
  if (!['cash', 'bonus'].includes(wallet_bucket)) return res.status(400).json({ error: 'Invalid wallet_bucket' })
  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0 || !Number.isInteger(amount_cents))
    return res.status(400).json({ error: 'Invalid amount_cents' })
  if (!reason?.trim()) return res.status(400).json({ error: 'Reason is required' })

  // Load wallet with version lock
  // Scoped: a wallet in another casino is not found, so it cannot be adjusted.
  let walletQ = supabaseAdmin.from('wallets').select('*').eq('user_id', player_id)
  walletQ = scopeToTenant(walletQ, gate)
  const { data: wallet } = await walletQ.maybeSingle()

  if (!wallet) return res.status(404).json({ error: 'Wallet not found' })
  const tenantId = tenantOf(wallet, gate)

  // Calculate new balance
  const balanceField = wallet_bucket === 'cash' ? 'cash_balance_cents' : 'bonus_balance_cents'
  const currentBalance = wallet[balanceField] || 0

  if (direction === 'debit' && amount_cents > currentBalance)
    return res.status(400).json({ error: `Insufficient ${wallet_bucket} balance. Current: $${(currentBalance / 100).toFixed(2)}` })

  const newBalance = direction === 'credit'
    ? currentBalance + amount_cents
    : currentBalance - amount_cents

  // For cash adjustments, keep withdrawable_cents in sync
  const updates = { [balanceField]: newBalance, version: wallet.version + 1 }
  if (wallet_bucket === 'cash') {
    const currentWithdrawable = wallet.withdrawable_cents || 0
    if (direction === 'credit') {
      updates.withdrawable_cents = currentWithdrawable + amount_cents
    } else {
      updates.withdrawable_cents = Math.max(0, currentWithdrawable - amount_cents)
    }
  }
  const { data: updatedWallet, error: updateErr } = await supabaseAdmin
    .from('wallets')
    .update(updates)
    .eq('id', wallet.id)
    .eq('version', wallet.version)
    .select().single()

  if (updateErr || !updatedWallet)
    return res.status(409).json({ error: 'Wallet modified concurrently. Please try again.' })

  // Create adjustment record
  const refId = `ADJ-${Date.now()}`
  await supabaseAdmin.from('wallet_adjustments').insert({
    tenant_id: tenantId,
    reference_id: refId,
    user_id: player_id,
    wallet_bucket,
    direction,
    amount_cents,
    reason,
    case_reference: case_reference || null,
    created_by: admin.id,
    approved_by: admin.id,
    requires_approval: false,
    status: 'approved',
  })

  // Create ledger entry
  const txType = direction === 'credit' ? 'adjustment_credit' : 'adjustment_debit'
  await supabaseAdmin.from('ledger').insert({
    tenant_id: tenantId,
    reference_id: `${refId}-${direction.toUpperCase()}`,
    user_id: player_id,
    type: txType,
    wallet_bucket,
    amount_cents,
    direction,
    balance_after_cents: newBalance,
    description: `Admin adjustment: ${reason}${case_reference ? ` (${case_reference})` : ''}`,
    created_by: admin.id,
    idempotency_key: `adj_${refId}_${direction}`,
  })

  // Notify player
  await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId,
    user_id: player_id,
    title: `Wallet ${direction === 'credit' ? 'Credited' : 'Adjusted'}`,
    message: `Your ${wallet_bucket} wallet has been ${direction === 'credit' ? 'credited' : 'debited'} $${(amount_cents / 100).toFixed(2)}. Reference: ${refId}.`,
  })

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: admin.id, actor_role: admin.role,
    action: `wallet_adjustment_${direction}`,
    target_type: 'wallet', target_id: wallet.id,
    before_state: { [balanceField]: currentBalance },
    after_state: { [balanceField]: newBalance },
    reason: `${reason}${case_reference ? ` | Case: ${case_reference}` : ''}`,
  }).then(() => {}, () => {})

  return res.status(200).json({
    message: `Wallet ${direction}ed successfully`,
    reference_id: refId,
    new_balance_cents: newBalance,
  })
}
