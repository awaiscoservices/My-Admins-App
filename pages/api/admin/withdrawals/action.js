/**
 * POST /api/admin/withdrawals/action
 *
 * Approves or rejects a Withdrawal request.
 *
 * Body: { withdrawal_id, action: 'approve'|'reject', rejection_reason?, proof_screenshot_url? }
 *
 * On approve:
 *   1. Validate withdrawal exists + is pending
 *   2. Check 24-hr rolling window against player's level daily_withdrawal_limit_cents
 *   3. Idempotency check
 *   4. Debit cash_balance_cents
 *   5. Write ledger entry
 *   6. Update daily_withdrawal_tracking
 *   7. Mark withdrawal approved + stamp level snapshot
 *   8. Audit log
 *
 * On reject:
 *   1. Mark rejected with reason
 *   2. Audit log
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.WITHDRAWALS_ACTION })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor

  const { withdrawal_id, action, rejection_reason, proof_screenshot_url } = req.body
  if (!withdrawal_id) return res.status(400).json({ error: 'withdrawal_id required' })
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action must be approve or reject' })

  // Fetch withdrawal
  // Scoped to the caller's casino: another casino's withdrawal is not found.
  const { row: withdrawal, error: wErr } = await loadOwnedRow(gate, 'withdrawals', withdrawal_id)
  if (wErr || !withdrawal) return res.status(404).json({ error: 'Withdrawal not found' })
  const tenantId = tenantOf(withdrawal, gate)
  if (!['pending', 'under_review'].includes(withdrawal.status)) {
    return res.status(409).json({ error: `Withdrawal is already ${withdrawal.status}` })
  }

  const playerId    = withdrawal.user_id
  const amountCents = withdrawal.amount_cents
  const now         = new Date().toISOString()

  // ── REJECT ───────────────────────────────────────────────────
  if (action === 'reject') {
    const { error: rejErr } = await supabaseAdmin
      .from('withdrawals')
      .update({
        status:           'rejected',
        rejection_reason: rejection_reason || 'Rejected by admin',
        reviewed_by:      actor.id,
        reviewed_at:      now,
        updated_at:       now,
      })
      .eq('id', withdrawal_id)

    if (rejErr) return res.status(500).json({ error: rejErr.message })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id:    actor.id,
      actor_role:  actor.role,
      action:      'withdrawal_rejected',
      target_type: 'withdrawal',
      target_id:   withdrawal_id,
      description: `Withdrawal ${withdrawal.reference_id} rejected`,
      reason:      rejection_reason || null,
    })

    return res.status(200).json({ ok: true, status: 'rejected' })
  }

  // ── APPROVE ──────────────────────────────────────────────────

  // Fetch player profile + level
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('player_level_id, player_levels(id, name, daily_withdrawal_limit_cents)')
    .eq('id', playerId)
    .single()

  const levelId           = profile?.player_level_id
  const levelName         = profile?.player_levels?.name || 'Bronze'
  const levelDailyLimit   = profile?.player_levels?.daily_withdrawal_limit_cents || 50000

  // Check daily withdrawal limit setting is enabled
  // This casino's own setting. Shared, one operator's limit applied to every
  // operator's players.
  const { data: limitSetting } = await scopeToTenant(
    supabaseAdmin.from('platform_settings').select('value')
      .eq('key', 'withdrawal_daily_limit_enabled'),
    gate,
  ).maybeSingle()
  const limitEnabled = limitSetting?.value !== false && limitSetting?.value !== 'false'

  if (limitEnabled) {
    // Get rolling 24hr total from ledger (source of truth)
    const { data: dailyTotal } = await supabaseAdmin
      .rpc('get_daily_withdrawn_cents', { p_user_id: playerId })

    const totalAfter = (dailyTotal || 0) + amountCents
    if (totalAfter > levelDailyLimit) {
      return res.status(422).json({
        error: `Daily withdrawal limit exceeded. Limit: $${(levelDailyLimit / 100).toFixed(2)} (${levelName}), Used: $${((dailyTotal || 0) / 100).toFixed(2)}, Requested: $${(amountCents / 100).toFixed(2)}`,
        code:  'DAILY_LIMIT_EXCEEDED',
        limit_cents:     levelDailyLimit,
        used_cents:      dailyTotal || 0,
        requested_cents: amountCents,
        level_name:      levelName,
      })
    }
  }

  // Fetch wallet
  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets').select('*').eq('user_id', playerId).single()
  if (walletErr || !wallet) return res.status(400).json({ error: 'Wallet not found' })

  // Cash balance check — withdrawals from cash only
  if (wallet.cash_balance_cents < amountCents) {
    return res.status(422).json({
      error: `Insufficient cash balance. Available: $${(wallet.cash_balance_cents / 100).toFixed(2)}, Requested: $${(amountCents / 100).toFixed(2)}`,
      code:  'INSUFFICIENT_CASH',
    })
  }

  // Idempotency check
  const idempKey = `wd-approve-${withdrawal_id}`
  const { data: existing } = await supabaseAdmin
    .from('ledger').select('id').eq('idempotency_key', idempKey).maybeSingle()
  if (existing) return res.status(200).json({ ok: true, status: 'paid', idempotent: true })

  const newCashBalance = wallet.cash_balance_cents - amountCents

  const dailyLimitSnapshot = {
    level_id:              levelId,
    level_name:            levelName,
    daily_limit_cents:     levelDailyLimit,
    limit_enabled:         limitEnabled,
    approved_by:           actor.full_name,
    approved_at:           now,
  }

  // Write wallet + ledger + withdrawal update in parallel
  const [walletRes, ledgerRes, withdrawalRes] = await Promise.all([
    supabaseAdmin.from('wallets').update({
      cash_balance_cents:   newCashBalance,
      total_withdrawn_cents: (wallet.total_withdrawn_cents || 0) + amountCents,
      updated_at:           now,
      version:              wallet.version + 1,
    }).eq('user_id', playerId).eq('version', wallet.version),

    supabaseAdmin.from('ledger').insert({
      tenant_id: tenantId,
      reference_id:        idempKey,
      user_id:             playerId,
      type:                'withdrawal',
      wallet_bucket:       'cash',
      amount_cents:        amountCents,
      direction:           'debit',
      balance_after_cents: newCashBalance,
      withdrawal_id:       withdrawal_id,
      description:         `Withdrawal ${withdrawal.reference_id} approved`,
      created_by:          actor.id,
      idempotency_key:     idempKey,
    }),

    supabaseAdmin.from('withdrawals').update({
      // 'paid', not 'approved'. The column allows pending, processing, paid,
      // rejected, cancelled and failed, so this write was refused every time
      // and no withdrawal could ever be approved. Approving is the payout:
      // the money leaves the wallet and the ledger records it in the same
      // breath, so paid is what has happened.
      status:                 'paid',
      reviewed_by:            actor.id,
      reviewed_at:            now,
      processed_by:           actor.id,
      processed_at:           now,
      updated_at:             now,
      level_id_at_time:       levelId,
      daily_limit_snapshot:   dailyLimitSnapshot,
      ...(proof_screenshot_url ? { proof_screenshot_url } : {}),
    }).eq('id', withdrawal_id),
  ])

  if (walletRes.error)     return res.status(500).json({ error: 'Wallet update failed: ' + walletRes.error.message })
  if (ledgerRes.error)     return res.status(500).json({ error: 'Ledger write failed: ' + ledgerRes.error.message })
  if (withdrawalRes.error) return res.status(500).json({ error: 'Withdrawal update failed: ' + withdrawalRes.error.message })

  // Update daily_withdrawal_tracking cache
  await supabaseAdmin.from('daily_withdrawal_tracking').upsert({
    user_id:              playerId,
    window_start:         new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    withdrawn_cents:      amountCents,  // will be summed from ledger on next check
    level_id_snapshot:    levelId,
    daily_limit_snapshot: levelDailyLimit,
    updated_at:           now,
  }, { onConflict: 'user_id' })

  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    actor.id,
    actor_role:  actor.role,
    action:      'withdrawal_approved',
    target_type: 'withdrawal',
    target_id:   withdrawal_id,
    description: `Withdrawal ${withdrawal.reference_id} approved — $${(amountCents / 100).toFixed(2)} (level: ${levelName}, limit: $${(levelDailyLimit / 100).toFixed(2)}/day)`,
  })

  return res.status(200).json({
    ok:           true,
    status:       'paid',
    amount_cents: amountCents,
    level_name:   levelName,
    daily_limit_cents: levelDailyLimit,
  })
}
