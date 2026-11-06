/**
 * POST /api/admin/deposits/action
 *
 * Approves or rejects a Deposit request.
 *
 * Body: { deposit_id, action: 'approve'|'reject', rejection_reason? }
 *
 * On approve:
 *   1. Validate deposit exists + is pending
 *   2. Credit cash_balance_cents on wallet
 *   3. Write ledger entry (idempotent)
 *   4. Mark deposit approved
 *   5. Call apply_deposit_bonus() RPC → bonus credited automatically
 *   6. Award XP (from deposit amount)
 *   7. Audit log
 *
 * On reject:
 *   1. Mark rejected with reason
 *   2. Recalculate player level downward if needed
 *   3. Audit log
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'finance']
// 1 XP per $10 deposited
const XP_PER_10_DOLLARS = 1

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role))
    return res.status(403).json({ error: 'Forbidden' })

  const { deposit_id, action, rejection_reason } = req.body
  if (!deposit_id) return res.status(400).json({ error: 'deposit_id required' })
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action must be approve or reject' })

  // Fetch deposit
  const { data: deposit, error: depErr } = await supabaseAdmin
    .from('deposits')
    .select('*')
    .eq('id', deposit_id)
    .single()

  if (depErr || !deposit) return res.status(404).json({ error: 'Deposit not found' })
  if (!['pending', 'under_review'].includes(deposit.status)) {
    return res.status(409).json({ error: `Deposit is already ${deposit.status}` })
  }

  const playerId    = deposit.user_id
  const amountCents = deposit.amount_cents
  const now         = new Date().toISOString()

  // ── REJECT ───────────────────────────────────────────────────
  if (action === 'reject') {
    const { error: rejErr } = await supabaseAdmin
      .from('deposits')
      .update({
        status:           'rejected',
        rejection_reason: rejection_reason || 'Rejected by admin',
        reviewed_by:      user.id,
        reviewed_at:      now,
        updated_at:       now,
      })
      .eq('id', deposit_id)

    if (rejErr) return res.status(500).json({ error: rejErr.message })

    // Level recalc on deposit rejection
    await _recalculateLevelOnDepositReject(playerId)

    await supabaseAdmin.from('audit_logs').insert({
      actor_id:    user.id,
      actor_role:  actor.role,
      action:      'deposit_rejected',
      target_type: 'deposit',
      target_id:   deposit_id,
      description: `Deposit ${deposit.reference_id} rejected`,
      reason:      rejection_reason || null,
    })

    return res.status(200).json({ ok: true, status: 'rejected' })
  }

  // ── APPROVE ──────────────────────────────────────────────────

  // Idempotency check
  const idempKey = `dep-approve-${deposit_id}`
  const { data: existing } = await supabaseAdmin
    .from('ledger').select('id').eq('idempotency_key', idempKey).maybeSingle()
  if (existing) return res.status(200).json({ ok: true, status: 'approved', idempotent: true })

  // Fetch wallet
  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets').select('*').eq('user_id', playerId).single()
  if (walletErr || !wallet) return res.status(400).json({ error: 'Wallet not found' })

  const newCashBalance = wallet.cash_balance_cents + amountCents

  // Write wallet + ledger + deposit update in parallel
  const [walletRes, ledgerRes, depositRes] = await Promise.all([
    supabaseAdmin.from('wallets').update({
      cash_balance_cents:   newCashBalance,
      total_deposited_cents: (wallet.total_deposited_cents || 0) + amountCents,
      updated_at:           now,
      version:              wallet.version + 1,
    }).eq('user_id', playerId).eq('version', wallet.version),

    supabaseAdmin.from('ledger').insert({
      reference_id:        idempKey,
      user_id:             playerId,
      type:                'deposit',
      wallet_bucket:       'cash',
      amount_cents:        amountCents,
      direction:           'credit',
      balance_after_cents: newCashBalance,
      deposit_id:          deposit_id,
      description:         `Deposit ${deposit.reference_id} approved`,
      created_by:          user.id,
      idempotency_key:     idempKey,
    }),

    supabaseAdmin.from('deposits').update({
      status:      'approved',
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at:  now,
    }).eq('id', deposit_id),
  ])

  if (walletRes.error)  return res.status(500).json({ error: 'Wallet update failed: ' + walletRes.error.message })
  if (ledgerRes.error)  return res.status(500).json({ error: 'Ledger write failed: ' + ledgerRes.error.message })
  if (depositRes.error) return res.status(500).json({ error: 'Deposit update failed: ' + depositRes.error.message })

  // Apply deposit bonus via RPC (handles level-based bonus + custom rules)
  let bonusCents = 0
  const { data: bonusResult } = await supabaseAdmin
    .rpc('apply_deposit_bonus', { p_deposit_id: deposit_id })
  if (bonusResult?.ok) bonusCents = bonusResult.bonus_cents || 0

  // Award XP for deposit (1 XP per $10)
  const xpAwarded = Math.floor(amountCents / 1000) * XP_PER_10_DOLLARS
  if (xpAwarded > 0) {
    await supabaseAdmin.rpc('award_xp', {
      p_user_id:      playerId,
      p_amount:       xpAwarded,
      p_source:       'deposit',
      p_reference_id: deposit.reference_id,
      p_notes:        `Deposit $${(amountCents / 100).toFixed(2)} → ${xpAwarded} XP`,
    })
  }

  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    user.id,
    actor_role:  actor.role,
    action:      'deposit_approved',
    target_type: 'deposit',
    target_id:   deposit_id,
    description: `Deposit ${deposit.reference_id} approved — $${(amountCents / 100).toFixed(2)} cash + $${(bonusCents / 100).toFixed(2)} bonus, XP: +${xpAwarded}`,
  })

  return res.status(200).json({
    ok:           true,
    status:       'approved',
    amount_cents: amountCents,
    bonus_cents:  bonusCents,
    xp_awarded:   xpAwarded,
  })
}

// Recalculate level downward when a deposit is rejected
async function _recalculateLevelOnDepositReject(playerId) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('total_xp, player_level_id').eq('id', playerId).single()
    if (!profile) return

    const { data: correctLevel } = await supabaseAdmin
      .from('player_levels').select('id')
      .lte('min_xp', profile.total_xp)
      .eq('is_active', true)
      .order('min_xp', { ascending: false })
      .limit(1).maybeSingle()

    if (!correctLevel || correctLevel.id === profile.player_level_id) return

    const oldLevelId = profile.player_level_id
    await supabaseAdmin.from('profiles')
      .update({ player_level_id: correctLevel.id }).eq('id', playerId)
    await supabaseAdmin.from('player_level_history').insert({
      user_id:       playerId,
      from_level_id: oldLevelId,
      to_level_id:   correctLevel.id,
      trigger:       'deposit_rejected',
    })
  } catch (e) {
    console.error('Level recalc on deposit reject failed:', e)
  }
}
