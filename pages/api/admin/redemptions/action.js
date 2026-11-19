/**
 * POST /api/admin/redemptions/action
 * Approve or reject a Redeem request.
 *
 * The route computes how much may be paid (eligibility + per-level daily cap)
 * and how much of that is "excess" (XP source) — these are reads. The money
 * movement then runs inside redemption_complete_atomic(): wallet credit (to the
 * bucket the redeem came from), ledger row, redemption status + snapshot, and
 * the excess-consumption record, all in one transaction. XP and eligibility
 * recalc run after as best-effort. Tenant isolation is enforced here.
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

  const { row: redemption, error: redemptionErr } = await loadOwnedRow(
    gate, 'redemptions', redemption_id,
    '*, game_accounts(id, user_id, game_username, game_panels(name, redeem_multiplier))'
  )
  if (redemptionErr || !redemption) return res.status(404).json({ error: 'Redeem not found' })
  const tenantId = tenantOf(redemption, gate)
  if (!['pending', 'under_review'].includes(redemption.status))
    return res.status(409).json({ error: `Redeem is already ${redemption.status}` })

  const playerId        = redemption.user_id
  const gameAccountId   = redemption.game_account_id
  const requestedCents  = redemption.requested_cents
  const panelName       = redemption.game_accounts?.game_panels?.name || null
  const accountUsername = redemption.game_accounts?.game_username || null

  // ── REJECT (no money moves) ─────────────────────────────────────
  if (action === 'reject') {
    if (!reason) return res.status(400).json({ error: 'A rejection reason is required.' })
    const { error: rejectErr } = await supabaseAdmin
      .from('redemptions')
      .update({
        status: 'rejected', rejection_reason: reason,
        reviewed_by: actor.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        game_panel_name: panelName, game_account_username: accountUsername,
      })
      .eq('id', redemption_id)
    if (rejectErr) return res.status(500).json({ error: rejectErr.message })

    await _recalculateLevelOnReject(supabaseAdmin, playerId)

    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: tenantId, actor_id: actor.id, actor_role: actor.role,
      action: 'redemption_rejected', target_type: 'redemption', target_id: redemption_id,
      description: `Redeem ${redemption.reference_id} rejected`, reason,
    }).then(() => {}, () => {})

    await supabaseAdmin.from('notifications').insert({
      tenant_id: tenantId, user_id: playerId, type: 'general',
      title: 'Redeem Request Rejected',
      message: `Your redeem request ${redemption.reference_id} was rejected. Reason: ${reason}`,
      reference_id: redemption.reference_id,
    }).then(() => {}, () => {})

    return res.status(200).json({ ok: true, status: 'rejected' })
  }

  // ── APPROVE — compute payable amount (reads), then one atomic write ──
  const { data: eligibility } = await supabaseAdmin
    .from('game_redemption_eligibility').select('*').eq('game_account_id', gameAccountId).maybeSingle()
  const remainingEligible = eligibility ? eligibility.remaining_cents : 0

  // Admin may lower the amount, never raise it above what was requested.
  const rawApproved = approved_cents ? Math.min(approved_cents, requestedCents) : requestedCents

  // Per-level Max Redeem cap — a hard ceiling per game per day.
  const { data: capProfile } = await supabaseAdmin
    .from('profiles').select('player_levels(name, max_redeem_cap_cents)').eq('id', playerId).maybeSingle()
  const levelName = capProfile?.player_levels?.name || 'This level'
  const dailyCap  = capProfile?.player_levels?.max_redeem_cap_cents ?? null

  let finalApproved = rawApproved
  if (dailyCap != null && dailyCap >= 0) {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const { data: todays } = await supabaseAdmin
      .from('redemptions').select('approved_cents')
      .eq('game_account_id', gameAccountId).eq('status', 'completed').gte('updated_at', dayStart.toISOString())
    const alreadyToday = (todays || []).reduce((s, r) => s + (r.approved_cents || 0), 0)
    finalApproved = Math.min(rawApproved, Math.max(0, dailyCap - alreadyToday))
    if (finalApproved <= 0) {
      return res.status(409).json({
        error: `${levelName} allows $${(dailyCap / 100).toFixed(2)} per game per day, and this game's allowance is already used up today.`,
      })
    }
  }

  const eligiblePortion = Math.min(finalApproved, remainingEligible)
  const excessCents     = Math.max(0, finalApproved - eligiblePortion)

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('player_levels(name, redeem_multiplier)').eq('id', playerId).maybeSingle()

  const ruleSnapshot = {
    level_name:        profile?.player_levels?.name || null,
    redeem_multiplier: eligibility?.multiplier_used || 1,
    eligible_cents:    remainingEligible,
    requested_cents:   requestedCents,
    approved_cents:    finalApproved,
    excess_cents:      excessCents,
    xp_rate:           XP_PER_DOLLAR_EXCESS,
    reviewed_by:       actor.full_name,
    reviewed_at:       new Date().toISOString(),
  }

  // ── Atomic money movement ──
  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('redemption_complete_atomic', {
    p_id:             redemption_id,
    p_admin:          actor.id,
    p_approved_cents: finalApproved,
    p_excess_cents:   excessCents,
    p_snapshot:       ruleSnapshot,
    p_panel:          panelName,
    p_username:       accountUsername,
  })
  if (rpcErr) return res.status(400).json({ error: rpcErr.message })

  // ── Best-effort side-effects — never roll back committed money ──
  const xpAwarded = result?.xp || 0
  if (xpAwarded > 0) {
    await supabaseAdmin.rpc('award_xp', {
      p_user_id:      playerId,
      p_amount:       xpAwarded,
      p_source:       'redeem_excess',
      p_reference_id: redemption.reference_id,
      p_notes:        `Excess $${(excessCents / 100).toFixed(2)} → ${xpAwarded} XP`,
    }).then(() => {}, () => {})
  }
  await supabaseAdmin.rpc('recalculate_eligibility', { p_game_account_id: gameAccountId }).then(() => {}, () => {})

  await supabaseAdmin.from('audit_logs').insert({
    tenant_id: tenantId, actor_id: actor.id, actor_role: actor.role,
    action: 'redemption_approved', target_type: 'redemption', target_id: redemption_id,
    description: `Redeem ${redemption.reference_id} approved — $${(finalApproved / 100).toFixed(2)} (excess: $${(excessCents / 100).toFixed(2)}, XP: +${xpAwarded})`,
  }).then(() => {}, () => {})

  return res.status(200).json({
    ok: true, status: 'completed',
    approved_cents: finalApproved, excess_cents: excessCents, xp_awarded: xpAwarded,
    bucket: result?.bucket || null,
  })
}

// On rejection, drop the player back to the level their XP still supports.
async function _recalculateLevelOnReject(client, playerId) {
  try {
    const { data: profile } = await client
      .from('profiles').select('total_xp, player_level_id, tenant_id').eq('id', playerId).single()
    if (!profile) return

    // Scope to the player's OWN casino and use xp_required (the column the admin
    // Levels editor writes). Without the tenant filter the tiers of every casino
    // tie on identical thresholds and an arbitrary one wins — which is how a
    // player ends up pointing at another tenant's level ("Unranked" on the site).
    const { data: correctLevel } = await client
      .from('player_levels').select('id')
      .eq('tenant_id', profile.tenant_id)
      .lte('xp_required', profile.total_xp || 0).eq('is_active', true)
      .order('xp_required', { ascending: false }).limit(1).maybeSingle()
    if (!correctLevel || correctLevel.id === profile.player_level_id) return

    const oldLevelId = profile.player_level_id
    await client.from('profiles').update({ player_level_id: correctLevel.id }).eq('id', playerId)
    await client.from('player_level_history').insert({
      user_id: playerId, from_level_id: oldLevelId, to_level_id: correctLevel.id,
      trigger: 'redeem_rejected', tenant_id: profile.tenant_id,
    }).then(() => {}, () => {})
  } catch (e) {
    console.error('Level recalc on reject failed:', e)
  }
}
