/**
 * POST /api/admin/game-loads/action
 *
 * Approves or rejects a Scores (game load) request.
 *
 * Body: { load_id, action: 'approve'|'reject', rejection_reason? }
 *
 * On approve:
 *   1. Validate load exists + is pending
 *   2. Check wallet has sufficient balance (cash first, then bonus)
 *   3. Debit wallet (cash bucket, then bonus if needed)
 *   4. Write ledger entries
 *   5. Record game_load_allocations
 *   6. Mark load completed
 *   7. Recalculate redemption eligibility for that game account
 *   8. Sync game_panel_name + game_account_username onto the load row
 *
 * On reject:
 *   1. Mark load rejected with reason
 *   2. Write audit log
 */
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.GAME_LOADS_ACTION })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor

  const { load_id, action, rejection_reason } = req.body
  if (!load_id) return res.status(400).json({ error: 'load_id required' })
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' })

  // Fetch the load with game account info
  // Scoped to the caller's casino: another casino's load is not found.
  const { row: load, error: loadErr } = await loadOwnedRow(
    gate, 'game_loads', load_id,
    '*, game_accounts(id, user_id, game_username, game_panels(name))'
  )

  if (loadErr || !load) return res.status(404).json({ error: 'Game load not found' })
  const tenantId = tenantOf(load, gate)
  if (!['pending', 'processing'].includes(load.status)) {
    return res.status(409).json({ error: `Load is already ${load.status}` })
  }

  const playerId       = load.user_id
  const amountCents    = load.amount_cents
  const gameAccountId  = load.game_account_id
  const panelName      = load.game_accounts?.game_panels?.name || null
  const accountUsername = load.game_accounts?.game_username || null

  // ── REJECT ──────────────────────────────────────────────────────
  if (action === 'reject') {
    const { error: rejectErr } = await supabaseAdmin
      .from('game_loads')
      .update({
        status:           'rejected',
        rejection_reason: rejection_reason || 'Rejected by admin',
        reviewed_by:      actor.id,
        reviewed_at:      new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', load_id)

    if (rejectErr) return res.status(500).json({ error: rejectErr.message })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id:    actor.id,
      actor_role:  actor.role,
      action:      'game_load_rejected',
      target_type: 'game_load',
      target_id:   load_id,
      description: `Game load ${load.reference_id} rejected`,
      reason:      rejection_reason || null,
    })

    return res.status(200).json({ ok: true, status: 'rejected' })
  }

  // ── APPROVE ─────────────────────────────────────────────────────

  // Fetch wallet with row lock
  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', playerId)
    .single()

  if (walletErr || !wallet) return res.status(400).json({ error: 'Wallet not found' })

  const availableCash  = wallet.cash_balance_cents
  const availableBonus = wallet.bonus_balance_cents
  const totalAvailable = availableCash + availableBonus

  if (totalAvailable < amountCents) {
    return res.status(422).json({
      error: `Insufficient balance. Available: $${(totalAvailable / 100).toFixed(2)}, Required: $${(amountCents / 100).toFixed(2)}`
    })
  }

  // Calculate how much comes from cash vs bonus (cash first)
  const cashUsed  = Math.min(availableCash, amountCents)
  const bonusUsed = amountCents - cashUsed

  const now = new Date().toISOString()
  const idempKey = `gl-approve-${load_id}`

  // Check idempotency
  const { data: existing } = await supabaseAdmin
    .from('ledger')
    .select('id')
    .eq('idempotency_key', idempKey)
    .maybeSingle()

  if (existing) return res.status(200).json({ ok: true, status: 'completed', idempotent: true })

  // Build wallet update
  const walletUpdate = {
    cash_balance_cents:  availableCash  - cashUsed,
    bonus_balance_cents: availableBonus - bonusUsed,
    total_loaded_cents:  (wallet.total_loaded_cents || 0) + amountCents,
    updated_at:          now,
    version:             wallet.version + 1,
  }

  // Build ledger entries (one per bucket used)
  const ledgerRows = []
  if (cashUsed > 0) {
    ledgerRows.push({
      tenant_id:         tenantId,
      reference_id:      `${idempKey}-cash`,
      user_id:           playerId,
      type:              'game_load',
      wallet_bucket:     'cash',
      amount_cents:      cashUsed,
      direction:         'debit',
      balance_after_cents: walletUpdate.cash_balance_cents,
      game_load_id:      load_id,
      description:       `Game load ${load.reference_id} — cash`,
      created_by:        actor.id,
      idempotency_key:   `${idempKey}-cash`,
    })
  }
  if (bonusUsed > 0) {
    ledgerRows.push({
      tenant_id:         tenantId,
      reference_id:      `${idempKey}-bonus`,
      user_id:           playerId,
      type:              'game_load',
      wallet_bucket:     'bonus',
      amount_cents:      bonusUsed,
      direction:         'debit',
      balance_after_cents: walletUpdate.bonus_balance_cents,
      game_load_id:      load_id,
      description:       `Game load ${load.reference_id} — bonus`,
      created_by:        actor.id,
      idempotency_key:   `${idempKey}-bonus`,
    })
  }

  // Execute all writes
  const [walletRes, ledgerRes, loadRes] = await Promise.all([
    supabaseAdmin.from('wallets').update(walletUpdate).eq('user_id', playerId).eq('version', wallet.version),
    supabaseAdmin.from('ledger').insert(ledgerRows),
    supabaseAdmin.from('game_loads').update({
      status:                'completed',
      reviewed_by:           actor.id,
      reviewed_at:           now,
      processed_by:          actor.id,
      processed_at:          now,
      updated_at:            now,
      game_panel_name:       panelName,
      game_account_username: accountUsername,
    }).eq('id', load_id),
  ])

  if (walletRes.error) return res.status(500).json({ error: 'Wallet update failed: ' + walletRes.error.message })
  if (ledgerRes.error) return res.status(500).json({ error: 'Ledger write failed: ' + ledgerRes.error.message })
  if (loadRes.error)   return res.status(500).json({ error: 'Load update failed: ' + loadRes.error.message })

  // Record allocation breakdown
  await supabaseAdmin.from('game_load_allocations').upsert({
    game_load_id:    load_id,
    user_id:         playerId,
    game_account_id: gameAccountId,
    cash_cents:      cashUsed,
    bonus_cents:     bonusUsed,
  }, { onConflict: 'game_load_id' })

  // Recalculate redemption eligibility for this game account
  await supabaseAdmin.rpc('recalculate_eligibility', { p_game_account_id: gameAccountId })

  // Audit log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:    actor.id,
    actor_role:  actor.role,
    action:      'game_load_approved',
    target_type: 'game_load',
    target_id:   load_id,
    description: `Game load ${load.reference_id} approved — $${(amountCents / 100).toFixed(2)} (cash: $${(cashUsed / 100).toFixed(2)}, bonus: $${(bonusUsed / 100).toFixed(2)})`,
  })

  return res.status(200).json({
    ok:         true,
    status:     'completed',
    cash_used:  cashUsed,
    bonus_used: bonusUsed,
  })
}
