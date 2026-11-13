/**
 * POST /api/admin/redemptions/action
 *
 * Approves or rejects a Redeem request.
 *
 * Body: { redemption_id, action: 'approve'|'reject', approved_cents?, rejection_reason? }
 *
 * On approve:
 *   1. Validate redemption exists + is pending
 *   2. Fetch eligibility for the game account
 *   3. Cap approved_cents to remaining_cents (eligibility)
 *   4. Calculate excess_cents = approved_cents - eligible portion (XP source)
 *   5. Credit cash_balance_cents on wallet
 *   6. Write ledger entry
 *   7. Update redemption: approved_cents, excess_cents, rule_snapshot
 *   8. Insert excess_score_consumptions record
 *   9. Award XP via award_xp() RPC
 *  10. Recalculate eligibility for the game account
 *  11. Recalculate player level
 *
 * On reject:
 *   1. Mark rejected with reason
 *   2. Audit log
 */
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'
const XP_PER_DOLLAR_EXCESS = 1  // 1 XP per $1 of excess scores

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.REDEMPTIONS_ACTION })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor

  const { redemption_id, action, approved_cents, rejection_reason, notes } = req.body
  const reason = (rejection_reason ?? notes ?? '').trim()
  if (!redemption_id) return res.status(400).json({ error: 'redemption_id required' })
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' })

  // Fetch redemption with game account info
  // Scoped to the caller's casino: another casino's redemption is not found.
  const { row: redemption, error: redemptionErr } = await loadOwnedRow(
    gate, 'redemptions', redemption_id,
    '*, game_accounts(id, user_id, game_username, game_panels(name, redeem_multiplier))'
  )

  if (redemptionErr || !redemption) return res.status(404).json({ error: 'Redeem not found' })
  const tenantId = tenantOf(redemption, gate)
  if (!['pending', 'under_review'].includes(redemption.status)) {
    return res.status(409).json({ error: `Redeem is already ${redemption.status}` })
  }

  const playerId       = redemption.user_id
  const gameAccountId  = redemption.game_account_id
  const requestedCents = redemption.requested_cents
  const panelName      = redemption.game_accounts?.game_panels?.name || null
  const accountUsername = redemption.game_accounts?.game_username || null

  // ── REJECT ──────────────────────────────────────────────────────
  if (action === 'reject') {
    if (!reason) return res.status(400).json({ error: 'A rejection reason is required.' })
    const { error: rejectErr } = await supabaseAdmin
      .from('redemptions')
      .update({
        status:           'rejected',
        rejection_reason: reason,
        reviewed_by:      actor.id,
        reviewed_at:      new Date().toISOString(),
        updated_at:       new Date().toISOString(),
        game_panel_name:       panelName,
        game_account_username: accountUsername,
      })
      .eq('id', redemption_id)

    if (rejectErr) return res.status(500).json({ error: rejectErr.message })

    // On rejection, recalculate player level downward if needed
    await _recalculateLevelOnReject(playerId)

    await supabaseAdmin.from('audit_logs').insert({
      actor_id:    actor.id,
      actor_role:  actor.role,
      action:      'redemption_rejected',
      target_type: 'redemption',
      target_id:   redemption_id,
      description: `Redeem ${redemption.reference_id} rejected`,
      reason:      reason,
    })

    await supabaseAdmin.from('notifications').insert({
      tenant_id: tenantId, user_id: playerId, type: 'general',
      title: 'Redeem Request Rejected',
      message: `Your redeem request ${redemption.reference_id} was rejected. Reason: ${reason}`,
      reference_id: redemption.reference_id,
    }).then(() => {}, () => {})

    return res.status(200).json({ ok: true, status: 'rejected' })
  }

  // ── APPROVE ─────────────────────────────────────────────────────

  // Fetch eligibility for this game account
  const { data: eligibility } = await supabaseAdmin
    .from('game_redemption_eligibility')
    .select('*')
    .eq('game_account_id', gameAccountId)
    .maybeSingle()

  // How much can they actually redeem?
  const remainingEligible = eligibility ? eligibility.remaining_cents : 0

  // Admin can override amount, but cap at requested
  const rawApproved   = approved_cents ? Math.min(approved_cents, requestedCents) : requestedCents
  // ── The player level's redeem cap ───────────────────────────────
  //
  // This line used to read `const finalApproved = rawApproved` with the
  // comment "admin approves the full amount regardless", so Max Redeem
  // Limit — set per level on Player Levels, and shown to players on their
  // Rewards page — decided nothing. The level rules were decoration.
  //
  // The Levels form describes the cap as a hard ceiling per game per day
  // that overrides the multiplier, so redemptions already approved today on
  // the same game account count against it.
  const { data: capProfile } = await supabaseAdmin
    .from('profiles')
    .select('player_levels(name, max_redeem_cap_cents)')
    .eq('id', playerId)
    .maybeSingle()

  const levelName = capProfile?.player_levels?.name || 'This level'
  const dailyCap  = capProfile?.player_levels?.max_redeem_cap_cents ?? null

  let finalApproved = rawApproved

  if (dailyCap != null && dailyCap >= 0) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    const { data: todays } = await supabaseAdmin
      .from('redemptions')
      .select('approved_cents')
      .eq('game_account_id', gameAccountId)
      .eq('status', 'completed')
      .gte('updated_at', dayStart.toISOString())

    const alreadyToday = (todays || []).reduce((sum, r) => sum + (r.approved_cents || 0), 0)
    finalApproved = Math.min(rawApproved, Math.max(0, dailyCap - alreadyToday))

    // Approving zero would mark the request completed and pay nothing, so
    // say what happened instead.
    if (finalApproved <= 0) {
      return res.status(409).json({
        error: `${levelName} allows $${(dailyCap / 100).toFixed(2)} per game per day, and this game's allowance is already used up today.`,
      })
    }
  }

  // Split what is actually being paid, not what was asked for.
  const eligiblePortion = Math.min(finalApproved, remainingEligible)
  const excessCents     = Math.max(0, finalApproved - eligiblePortion)

  // Fetch wallet
  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', playerId)
    .single()

  if (walletErr || !wallet) return res.status(400).json({ error: 'Wallet not found' })

  // Idempotency check
  const idempKey = `redeem-approve-${redemption_id}`
  const { data: existing } = await supabaseAdmin
    .from('ledger')
    .select('id')
    .eq('idempotency_key', idempKey)
    .maybeSingle()

  if (existing) return res.status(200).json({ ok: true, status: 'completed', idempotent: true })

  const now = new Date().toISOString()

  // Fetch player level for rule_snapshot
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('player_level_id, total_xp, player_levels(name, redeem_multiplier, bonus_to_cash_pct)')
    .eq('id', playerId)
    .single()

  const ruleSnapshot = {
    level_name:       profile?.player_levels?.name || null,
    redeem_multiplier: eligibility?.multiplier_used || 1,
    eligible_cents:    remainingEligible,
    requested_cents:   requestedCents,
    approved_cents:    finalApproved,
    excess_cents:      excessCents,
    xp_rate:           XP_PER_DOLLAR_EXCESS,
    reviewed_by:       actor.full_name,
    reviewed_at:       now,
  }

  const newCashBalance = wallet.cash_balance_cents + finalApproved

  // Write everything in parallel
  const [walletRes, ledgerRes, redemptionRes] = await Promise.all([
    supabaseAdmin.from('wallets').update({
      cash_balance_cents:    newCashBalance,
      // Winnings are withdrawable. Only deposits raised this before, while
      // loading a game lowered it, so a player who deposited $25, played it
      // through and redeemed $100 had $95 of cash and nothing they could
      // withdraw. Redeemed money has already been played through, which is
      // exactly what this figure is meant to mean.
      withdrawable_cents:    (wallet.withdrawable_cents || 0) + finalApproved,
      total_redeemed_cents:  (wallet.total_redeemed_cents || 0) + finalApproved,
      updated_at:            now,
      version:               wallet.version + 1,
    }).eq('user_id', playerId).eq('version', wallet.version),

    supabaseAdmin.from('ledger').insert({
      tenant_id: tenantId,
      reference_id:        idempKey,
      user_id:             playerId,
      type:                'redeem',
      wallet_bucket:       'cash',
      amount_cents:        finalApproved,
      direction:           'credit',
      balance_after_cents: newCashBalance,
      redeem_id:           redemption_id,
      // Name the game, same as a game load does: a wallet line that says
      // only REDEEM-000123 does not tell the player where it came from.
      description:         panelName ? `Redeem — ${panelName} (${redemption.reference_id})` : `Redeem ${redemption.reference_id} approved`,
      created_by:          actor.id,
      idempotency_key:     idempKey,
    }),

    supabaseAdmin.from('redemptions').update({
      status:                'completed',
      approved_cents:        finalApproved,
      amount_cents:          finalApproved,
      approved_amount_cents: finalApproved,
      excess_cents:          excessCents,
      rule_snapshot:         ruleSnapshot,
      reviewed_by:           actor.id,
      reviewed_at:           now,
      processed_by:          actor.id,
      processed_at:          now,
      updated_at:            now,
      game_panel_name:       panelName,
      game_account_username: accountUsername,
    }).eq('id', redemption_id),
  ])

  if (walletRes.error)     return res.status(500).json({ error: 'Wallet update failed: ' + walletRes.error.message })
  if (ledgerRes.error)     return res.status(500).json({ error: 'Ledger write failed: ' + ledgerRes.error.message })
  if (redemptionRes.error) return res.status(500).json({ error: 'Redeem update failed: ' + redemptionRes.error.message })

  // Record excess consumption + award XP (fire & forget style, non-blocking)
  const xpAwarded = excessCents > 0 ? Math.floor(excessCents / 100) * XP_PER_DOLLAR_EXCESS : 0

  if (excessCents > 0) {
    await supabaseAdmin.from('excess_score_consumptions').upsert({
      user_id:       playerId,
      redemption_id: redemption_id,
      excess_cents:  excessCents,
      xp_awarded:    xpAwarded,
      xp_rate:       XP_PER_DOLLAR_EXCESS,
    }, { onConflict: 'redemption_id' })

    if (xpAwarded > 0) {
      await supabaseAdmin.rpc('award_xp', {
        p_user_id:      playerId,
        p_amount:       xpAwarded,
        p_source:       'redeem_excess',
        p_reference_id: redemption.reference_id,
        p_notes:        `Excess $${(excessCents / 100).toFixed(2)} → ${xpAwarded} XP`,
      })
    }
  }

  // Recalculate eligibility
  await supabaseAdmin.rpc('recalculate_eligibility', { p_game_account_id: gameAccountId })

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    actor.id,
    actor_role:  actor.role,
    action:      'redemption_approved',
    target_type: 'redemption',
    target_id:   redemption_id,
    description: `Redeem ${redemption.reference_id} approved — $${(finalApproved / 100).toFixed(2)} (excess: $${(excessCents / 100).toFixed(2)}, XP: +${xpAwarded})`,
  })

  return res.status(200).json({
    ok:            true,
    status:        'completed',
    approved_cents: finalApproved,
    excess_cents:   excessCents,
    xp_awarded:     xpAwarded,
  })
}

// On deposit rejection: recalculate level based on highest successful deposit total
async function _recalculateLevelOnReject(playerId) {
  try {
    // Sum all approved (non-rejected) deposits to find current deposit total
    const { data: depositSum } = await supabaseAdmin
      .from('deposits')
      .select('amount_cents')
      .eq('user_id', playerId)
      .eq('status', 'approved')

    const totalDeposited = (depositSum || []).reduce((s, r) => s + r.amount_cents, 0)

    // Get current XP
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('total_xp, player_level_id')
      .eq('id', playerId)
      .single()

    if (!profile) return

    // Find highest level player still qualifies for by XP
    const { data: correctLevel } = await supabaseAdmin
      .from('player_levels')
      .select('id')
      .lte('min_xp', profile.total_xp)
      .eq('is_active', true)
      .order('min_xp', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!correctLevel) return

    if (correctLevel.id !== profile.player_level_id) {
      const oldLevelId = profile.player_level_id
      await supabaseAdmin
        .from('profiles')
        .update({ player_level_id: correctLevel.id })
        .eq('id', playerId)

      await supabaseAdmin.from('player_level_history').insert({
        user_id:       playerId,
        from_level_id: oldLevelId,
        to_level_id:   correctLevel.id,
        trigger:       'deposit_rejected',
      })
    }
  } catch (e) {
    console.error('Level recalc on reject failed:', e)
  }
}
