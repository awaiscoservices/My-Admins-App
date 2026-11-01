import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'finance', 'game_ops']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role)) return res.status(403).json({ error: 'Forbidden' })

  const { load_id, action, notes } = req.body
  if (!load_id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'load_id and action (approve|reject) required' })
  }

  const { data: load, error: loadErr } = await supabaseAdmin
    .from('game_loads').select('*').eq('id', load_id).single()
  if (loadErr || !load) return res.status(404).json({ error: 'Game load not found' })
  if (load.status !== 'pending') return res.status(400).json({ error: `Already ${load.status}` })

  // Atomic status lock — prevents double-processing
  const { data: locked, error: lockErr } = await supabaseAdmin
    .from('game_loads')
    .update({ status: action === 'reject' ? 'rejected' : 'processing', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', load_id)
    .eq('status', 'pending')
    .select('id').single()
  if (lockErr || !locked) return res.status(409).json({ error: 'Game load already being processed — try again' })

  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets')
    .select('id, cash_balance_cents, bonus_balance_cents, reserved_cents, version')
    .eq('user_id', load.user_id)
    .single()
  if (walletErr || !wallet) return res.status(404).json({ error: 'Wallet not found' })

  if (action === 'reject') {
    // Refund wallet — cash was debited at submission, reserved_cents was incremented
    const bucket = load.wallet_bucket === 'bonus' ? 'bonus_balance_cents' : 'cash_balance_cents'
    const currentBal = load.wallet_bucket === 'bonus' ? wallet.bonus_balance_cents : wallet.cash_balance_cents
    const newBal = currentBal + load.amount_cents
    const newReserved = Math.max(0, (wallet.reserved_cents || 0) - load.amount_cents)

    const updateObj = {
      [bucket]: newBal,
      reserved_cents: newReserved,
      version: wallet.version + 1,
      updated_at: new Date().toISOString(),
    }

    const { data: updated } = await supabaseAdmin.from('wallets')
      .update(updateObj).eq('id', wallet.id).eq('version', wallet.version)
      .select('id').single()

    if (!updated) return res.status(409).json({ error: 'Wallet conflict, retry' })

    await supabaseAdmin.from('ledger').insert({
      user_id: load.user_id,
      direction: 'credit',
      amount_cents: load.amount_cents,
      balance_after_cents: newBal,
      reference_id: load.reference_id,
      description: `Game load rejected — refunded. Ref: ${load.reference_id}`,
    })

    await supabaseAdmin.from('game_loads').update({ notes }).eq('id', load_id)

    await supabaseAdmin.from('notifications').insert({
      user_id: load.user_id,
      title: '❌ Game Load Rejected',
      message: `Your game load of $${(load.amount_cents / 100).toFixed(2)} was rejected and refunded.${notes ? ' Note: ' + notes : ''} Ref: ${load.reference_id}`,
    })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'game_load_rejected',
      target_type: 'game_load',
      target_id: load_id,
      details: { reference_id: load.reference_id, notes },
    })

    return res.status(200).json({ success: true, status: 'rejected' })
  }

  // APPROVE — cash was debited at submission; clear reserved_cents
  const newReserved = Math.max(0, (wallet.reserved_cents || 0) - load.amount_cents)

  await supabaseAdmin.from('wallets')
    .update({ reserved_cents: newReserved, updated_at: new Date().toISOString() })
    .eq('id', wallet.id)

  // Append ledger entry recording the completed load
  await supabaseAdmin.from('ledger').insert({
    user_id: load.user_id,
    type: 'game_load',
    direction: 'debit',
    amount_cents: load.amount_cents,
    balance_after_cents: wallet.cash_balance_cents, // unchanged on approve
    reference_id: load.reference_id,
    description: `Game load approved — ${load.game_panel_name || 'game'}. Ref: ${load.reference_id}`,
  })

  await supabaseAdmin.from('game_loads').update({ status: 'approved', notes }).eq('id', load_id)

  await supabaseAdmin.from('notifications').insert({
    user_id: load.user_id,
    title: '✅ Game Load Approved',
    message: `Your game load of $${(load.amount_cents / 100).toFixed(2)} for ${load.game_panel_name || 'your game account'} has been processed. Ref: ${load.reference_id}`,
  })

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'game_load_approved',
    target_type: 'game_load',
    target_id: load_id,
    details: { reference_id: load.reference_id, amount_cents: load.amount_cents },
  })

  return res.status(200).json({ success: true, status: 'approved' })
}
