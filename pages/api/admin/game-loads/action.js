/**
 * POST /api/admin/game-loads/action
 * Approve or reject a game load request.
 * On approve: debit player cash wallet, ledger entry, notify player.
 * Roles: super_admin, game_ops
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

  if (!admin || !['super_admin', 'game_ops'].includes(admin.role))
    return res.status(403).json({ error: 'Insufficient permissions' })

  const { load_id, action, reason } = req.body

  if (!load_id || !['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'load_id and action (approve|reject) required' })
  if (action === 'reject' && !reason?.trim())
    return res.status(400).json({ error: 'Reason required for rejection' })

  const { data: load } = await supabaseAdmin
    .from('game_loads')
    .select('*, game_accounts(id, user_id, game_panels(name))')
    .eq('id', load_id).single()

  if (!load) return res.status(404).json({ error: 'Game load not found' })
  if (load.status !== 'pending') return res.status(409).json({ error: `Already ${load.status}` })

  const playerId   = load.game_accounts?.user_id || load.user_id
  const gameName   = load.game_accounts?.game_panels?.name || 'Game'
  const amountCents = load.amount_cents

  if (action === 'reject') {
    await supabaseAdmin.from('game_loads').update({
      status: 'rejected', reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(), notes: reason,
    }).eq('id', load_id)

    await supabaseAdmin.from('notifications').insert({
      user_id: playerId, type: 'general',
      title: 'Game Load Rejected',
      message: `Your game load of $${(amountCents / 100).toFixed(2)} to ${gameName} was rejected. Reason: ${reason}`,
    })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id, actor_role: admin.role,
      action: 'game_load_rejected',
      target_type: 'game_load', target_id: load_id,
      before_state: { status: 'pending' }, after_state: { status: 'rejected' }, reason,
    }).catch(() => {})

    return res.status(200).json({ message: 'Game load rejected' })
  }

  // APPROVE — debit cash wallet with optimistic lock
  const { data: wallet } = await supabaseAdmin
    .from('wallets').select('*').eq('user_id', playerId).single()

  if (!wallet) return res.status(404).json({ error: 'Player wallet not found' })
  if ((wallet.cash_balance_cents || 0) < amountCents)
    return res.status(400).json({ error: `Insufficient cash. Has: $${(wallet.cash_balance_cents / 100).toFixed(2)}, needs: $${(amountCents / 100).toFixed(2)}` })

  const newCash = wallet.cash_balance_cents - amountCents
  const { data: updatedWallet, error: updateErr } = await supabaseAdmin
    .from('wallets')
    .update({ cash_balance_cents: newCash, version: wallet.version + 1 })
    .eq('id', wallet.id).eq('version', wallet.version)
    .select().single()

  if (updateErr || !updatedWallet)
    return res.status(409).json({ error: 'Wallet modified concurrently. Please retry.' })

  await supabaseAdmin.from('game_loads').update({
    status: 'approved', reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', load_id)

  await supabaseAdmin.from('ledger').insert({
    reference_id: `${load.reference_id}-DEBIT`,
    user_id: playerId, type: 'game_load',
    wallet_bucket: 'cash', amount_cents: amountCents,
    direction: 'debit', balance_after_cents: newCash,
    description: `Game load approved: ${gameName}`,
    created_by: admin.id,
    idempotency_key: `load_approve_${load_id}`,
  })

  await supabaseAdmin.from('notifications').insert({
    user_id: playerId, type: 'general',
    title: 'Game Load Approved ✅',
    message: `Your game load of $${(amountCents / 100).toFixed(2)} to ${gameName} has been approved!`,
    reference_id: load.reference_id,
  })

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id, actor_role: admin.role,
    action: 'game_load_approved',
    target_type: 'game_load', target_id: load_id,
    before_state: { status: 'pending', cash_balance_cents: wallet.cash_balance_cents },
    after_state: { status: 'approved', cash_balance_cents: newCash },
  }).catch(() => {})

  return res.status(200).json({ message: 'Game load approved successfully' })
}
