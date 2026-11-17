/**
 * POST /api/admin/game-loads/action
 * Approve or reject a Scores (game load) request.
 *
 * The money movement runs inside game_load_action_atomic():
 *   approve → releases the reserve, records the load in its bucket, writes the
 *             allocation row (cash was debited at request time — not again)
 *   reject  → returns the held funds to their bucket, restoring the withdrawable
 *             hold for a cash-funded load, with a ledger row
 * All under row locks, commit-or-rollback. Eligibility recalc runs after as a
 * best-effort step. Tenant isolation is enforced here (loadOwnedRow).
 */
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.GAME_LOADS_ACTION })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor

  const { load_id, action, rejection_reason, notes } = req.body
  const reason = (rejection_reason ?? notes ?? '').trim()
  if (!load_id) return res.status(400).json({ error: 'load_id required' })
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' })
  if (action === 'reject' && !reason) return res.status(400).json({ error: 'A rejection reason is required.' })

  // Load (scoped to the caller's casino) with the game account / panel info.
  const { row: load, error: loadErr } = await loadOwnedRow(
    gate, 'game_loads', load_id,
    '*, game_accounts(id, user_id, game_username, game_panels(name))'
  )
  if (loadErr || !load) return res.status(404).json({ error: 'Game load not found' })
  const tenantId = tenantOf(load, gate)
  if (!['pending', 'processing'].includes(load.status))
    return res.status(409).json({ error: `Load is already ${load.status}` })

  const playerId        = load.user_id
  const amountCents     = load.amount_cents
  const gameAccountId   = load.game_account_id
  const panelName       = load.game_accounts?.game_panels?.name || null
  const accountUsername = load.game_accounts?.game_username || null

  // ── Atomic money movement ──
  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('game_load_action_atomic', {
    p_id:       load_id,
    p_action:   action,
    p_reason:   reason || null,
    p_admin:    actor.id,
    p_panel:    panelName,
    p_username: accountUsername,
  })
  if (rpcErr) return res.status(400).json({ error: rpcErr.message })

  // ── Best-effort side-effects — never roll back committed money ──
  if (action === 'approve') {
    // Recalculate how much this game account may now redeem.
    await supabaseAdmin.rpc('recalculate_eligibility', { p_game_account_id: gameAccountId }).then(() => {}, () => {})
  } else {
    await supabaseAdmin.from('notifications').insert({
      tenant_id: tenantId, user_id: playerId, type: 'general',
      title: 'Scores Request Rejected',
      message: `Your scores request ${load.reference_id} was rejected. Reason: ${reason}`,
      reference_id: load.reference_id,
    }).then(() => {}, () => {})
  }

  await supabaseAdmin.from('audit_logs').insert({
    tenant_id:   tenantId,
    actor_id:    actor.id,
    actor_role:  actor.role,
    action:      action === 'approve' ? 'game_load_approved' : 'game_load_rejected',
    target_type: 'game_load',
    target_id:   load_id,
    description: `Game load ${load.reference_id} ${action} — $${(amountCents / 100).toFixed(2)}${result?.bucket ? ` (${result.bucket})` : ''}`,
    reason:      action === 'reject' ? reason : null,
  }).then(() => {}, () => {})

  return res.status(200).json({
    ok:     true,
    status: action === 'approve' ? 'completed' : 'rejected',
    bucket: result?.bucket || null,
  })
}
