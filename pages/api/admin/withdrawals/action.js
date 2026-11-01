import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'finance']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) return res.status(403).json({ error: 'Forbidden' })

  const { withdrawal_id, action, notes } = req.body
  if (!withdrawal_id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'withdrawal_id and action (approve|reject) required' })
  }

  const { data: wd, error: wdErr } = await supabaseAdmin
    .from('withdrawals').select('*').eq('id', withdrawal_id).single()
  if (wdErr || !wd) return res.status(404).json({ error: 'Withdrawal not found' })
  if (wd.status !== 'pending') return res.status(400).json({ error: `Already ${wd.status}` })

  // Atomic status lock — prevents double-processing
  const { data: locked, error: lockErr } = await supabaseAdmin
    .from('withdrawals')
    .update({ status: action === 'reject' ? 'rejected' : 'processing', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', withdrawal_id)
    .eq('status', 'pending')
    .select('id').single()
  if (lockErr || !locked) return res.status(409).json({ error: 'Withdrawal already being processed — try again' })

  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets')
    .select('id, cash_balance_cents, withdrawable_cents, reserved_cents, total_withdrawn_cents, version')
    .eq('user_id', wd.user_id)
    .single()
  if (walletErr || !wallet) return res.status(404).json({ error: 'Wallet not found' })

  if (action === 'reject') {
    // Refund: reverse the debit that happened at submission
    // cash_balance_cents was decremented, reserved_cents was incremented — undo both
    const newCash = wallet.cash_balance_cents + wd.amount_cents
    const newWithdrawable = (wallet.withdrawable_cents || 0) + wd.amount_cents
    const newReserved = Math.max(0, (wallet.reserved_cents || 0) - wd.amount_cents)

    const { data: updated } = await supabaseAdmin.from('wallets')
      .update({
        cash_balance_cents: newCash,
        withdrawable_cents: newWithdrawable,
        reserved_cents: newReserved,
        version: wallet.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id)
      .eq('version', wallet.version)
      .select('id').single()

    if (!updated) return res.status(409).json({ error: 'Wallet conflict, retry' })

    // Append a refund entry — never mutate existing ledger rows
    await supabaseAdmin.from('ledger').insert({
      user_id: wd.user_id,
      direction: 'credit',
      amount_cents: wd.amount_cents,
      balance_after_cents: newCash,
      reference_id: wd.reference_id,
      description: `Withdrawal rejected — refunded. Ref: ${wd.reference_id}`,
    })

    await supabaseAdmin.from('withdrawals').update({ notes }).eq('id', withdrawal_id)

    await supabaseAdmin.from('notifications').insert({
      user_id: wd.user_id,
      title: '❌ Withdrawal Rejected',
      message: `Your withdrawal of $${(wd.amount_cents / 100).toFixed(2)} was rejected and refunded to your wallet.${notes ? ' Note: ' + notes : ''} Ref: ${wd.reference_id}`,
    })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'withdrawal_rejected',
      target_type: 'withdrawal',
      target_id: withdrawal_id,
      details: { reference_id: wd.reference_id, notes },
    })

    return res.status(200).json({ success: true, status: 'rejected' })
  }

  // APPROVE — wallet cash was debited at submission; reserved_cents was incremented.
  // On approval: clear reserved_cents, decrement withdrawable_cents, increment total_withdrawn_cents.
  const newReserved = Math.max(0, (wallet.reserved_cents || 0) - wd.amount_cents)
  const newWithdrawable = Math.max(0, (wallet.withdrawable_cents || 0) - wd.amount_cents)
  const newTotalWithdrawn = (wallet.total_withdrawn_cents || 0) + wd.amount_cents

  const { data: updated } = await supabaseAdmin.from('wallets')
    .update({
      reserved_cents: newReserved,
      withdrawable_cents: newWithdrawable,
      total_withdrawn_cents: newTotalWithdrawn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id)
    .select('id').single()

  if (!updated) return res.status(409).json({ error: 'Wallet update failed' })

  // Append final ledger record (cash was already debited at submission — this records completion)
  await supabaseAdmin.from('ledger').insert({
    user_id: wd.user_id,
    type: 'withdrawal',
    direction: 'debit',
    amount_cents: wd.amount_cents,
    balance_after_cents: wallet.cash_balance_cents, // balance unchanged on approve (debit was at submission)
    reference_id: wd.reference_id,
    description: `Withdrawal completed — ${wd.destination || wd.method}. Ref: ${wd.reference_id}`,
  })

  await supabaseAdmin.from('withdrawals').update({
    status: 'completed',
    notes,
  }).eq('id', withdrawal_id)

  await supabaseAdmin.from('notifications').insert({
    user_id: wd.user_id,
    title: '✅ Withdrawal Sent',
    message: `Your withdrawal of $${(wd.amount_cents / 100).toFixed(2)} via ${wd.method || 'transfer'} has been processed. Ref: ${wd.reference_id}`,
  })

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'withdrawal_approved',
    target_type: 'withdrawal',
    target_id: withdrawal_id,
    details: { reference_id: wd.reference_id, amount_cents: wd.amount_cents, method: wd.method },
  })

  return res.status(200).json({ success: true, status: 'completed' })
}
