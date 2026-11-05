/**
 * POST /api/admin/players/adjust-wallet
 * Apply a manual wallet adjustment with full ledger entry + audit log.
 * Admin CANNOT set a balance directly — only adjust with a reason.
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

  const allowedRoles = ['super_admin', 'finance']
  if (!admin || !allowedRoles.includes(admin.role))
    return res.status(403).json({ error: 'Insufficient permissions. Finance role required.' })

  const { player_id, direction, wallet_bucket, amount_cents, reason, case_reference } = req.body

  // Validate
  if (!player_id) return res.status(400).json({ error: 'player_id required' })
  if (!['credit', 'debit'].includes(direction)) return res.status(400).json({ error: 'Invalid direction' })
  if (!['cash', 'bonus'].includes(wallet_bucket)) return res.status(400).json({ error: 'Invalid wallet_bucket' })
  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0 || !Number.isInteger(amount_cents))
    return res.status(400).json({ error: 'Invalid amount_cents' })
  if (!reason?.trim()) return res.status(400).json({ error: 'Reason is required' })

  // Load wallet with version lock
  const { data: wallet } = await supabaseAdmin
    .from('wallets').select('*').eq('user_id', player_id).single()

  if (!wallet) return res.status(404).json({ error: 'Wallet not found' })

  // Calculate new balance
  const balanceField = wallet_bucket === 'cash' ? 'cash_balance_cents' : 'bonus_balance_cents'
  const currentBalance = wallet[balanceField] || 0

  if (direction === 'debit' && amount_cents > currentBalance)
    return res.status(400).json({ error: `Insufficient ${wallet_bucket} balance. Current: $${(currentBalance / 100).toFixed(2)}` })

  const newBalance = direction === 'credit'
    ? currentBalance + amount_cents
    : currentBalance - amount_cents

  // Update wallet with optimistic lock
  const updates = { [balanceField]: newBalance, version: wallet.version + 1 }
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
    user_id: player_id,
    type: 'general',
    title: `Wallet ${direction === 'credit' ? 'Credited' : 'Adjusted'}`,
    message: `Your ${wallet_bucket} wallet has been ${direction === 'credit' ? 'credited' : 'debited'} $${(amount_cents / 100).toFixed(2)}. Reference: ${refId}.`,
    reference_id: refId,
  })

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
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
