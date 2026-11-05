/**
 * POST /api/admin/redemptions/action
 * Approve or reject a redemption. On approve: credit cash + withdrawable wallet.
 * Admin may override amount (approved_amount_cents) to credit less than requested.
 * Roles: super_admin, game_ops, finance
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

  if (!admin || !['super_admin', 'game_ops', 'finance'].includes(admin.role))
    return res.status(403).json({ error: 'Insufficient permissions' })

  const { redemption_id, action, reason, approved_amount_cents } = req.body

  if (!redemption_id || !['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'redemption_id and action required' })
  if (action === 'reject' && !reason?.trim())
    return res.status(400).json({ error: 'Reason required for rejection' })

  const { data: redemption } = await supabaseAdmin
    .from('redemptions')
    .select('*, game_accounts(id, user_id, game_panels(name))')
    .eq('id', redemption_id).single()

  if (!redemption) return res.status(404).json({ error: 'Redemption not found' })
  if (redemption.status !== 'pending') return res.status(409).json({ error: `Already ${redemption.status}` })

  const playerId   = redemption.game_accounts?.user_id || redemption.user_id
  const gameName   = redemption.game_accounts?.game_panels?.name || 'Game'
  const reqCents   = redemption.amount_cents
  const finalCents = (approved_amount_cents && Number.isInteger(approved_amount_cents) && approved_amount_cents > 0)
    ? approved_amount_cents : reqCents

  if (action === 'reject') {
    await supabaseAdmin.from('redemptions').update({
      status: 'rejected', reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(), notes: reason,
    }).eq('id', redemption_id)

    await supabaseAdmin.from('notifications').insert({
      user_id: playerId, type: 'general',
      title: 'Redemption Rejected',
      message: `Your redemption of $${(reqCents / 100).toFixed(2)} from ${gameName} was rejected. Reason: ${reason}`,
    })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id, actor_role: admin.role,
      action: 'redemption_rejected',
      target_type: 'redemption', target_id: redemption_id,
      before_state: { status: 'pending' }, after_state: { status: 'rejected' }, reason,
    }).catch(() => {})

    return res.status(200).json({ message: 'Redemption rejected' })
  }

  // APPROVE — credit cash wallet
  const { data: wallet } = await supabaseAdmin
    .from('wallets').select('*').eq('user_id', playerId).single()

  if (!wallet) return res.status(404).json({ error: 'Player wallet not found' })

  const newCash         = (wallet.cash_balance_cents || 0) + finalCents
  const newWithdrawable = (wallet.withdrawable_cents  || 0) + finalCents

  const { data: updatedWallet, error: updateErr } = await supabaseAdmin
    .from('wallets')
    .update({ cash_balance_cents: newCash, withdrawable_cents: newWithdrawable, version: wallet.version + 1 })
    .eq('id', wallet.id).eq('version', wallet.version)
    .select().single()

  if (updateErr || !updatedWallet)
    return res.status(409).json({ error: 'Wallet modified concurrently. Please retry.' })

  await supabaseAdmin.from('redemptions').update({
    status: 'approved',
    approved_amount_cents: finalCents,
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', redemption_id)

  await supabaseAdmin.from('ledger').insert({
    reference_id: `${redemption.reference_id}-CREDIT`,
    user_id: playerId, type: 'redemption',
    wallet_bucket: 'cash', amount_cents: finalCents,
    direction: 'credit', balance_after_cents: newCash,
    description: `Redemption from ${gameName}${finalCents !== reqCents ? ` (requested $${(reqCents/100).toFixed(2)})` : ''}`,
    created_by: admin.id,
    idempotency_key: `redeem_approve_${redemption_id}`,
  })

  await supabaseAdmin.rpc('increment_player_xp', {
    p_user_id: playerId, p_xp: Math.floor(finalCents / 100),
  }).catch(() => {})

  const partialNote = finalCents !== reqCents ? ` (adjusted from $${(reqCents/100).toFixed(2)})` : ''
  await supabaseAdmin.from('notifications').insert({
    user_id: playerId, type: 'general',
    title: 'Redemption Approved 🎉',
    message: `$${(finalCents / 100).toFixed(2)}${partialNote} from ${gameName} has been credited to your wallet!`,
    reference_id: redemption.reference_id,
  })

  await supabaseAdmin.from('audit_logs').insert({
    actor_id: admin.id, actor_role: admin.role,
    action: 'redemption_approved',
    target_type: 'redemption', target_id: redemption_id,
    before_state: { status: 'pending', cash_balance_cents: wallet.cash_balance_cents },
    after_state: { status: 'approved', approved_amount_cents: finalCents, cash_balance_cents: newCash },
  }).catch(() => {})

  return res.status(200).json({ message: 'Redemption approved', credited_cents: finalCents })
}
