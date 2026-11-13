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

  const { load_id, action, rejection_reason, notes } = req.body
  const reason = (rejection_reason ?? notes ?? '').trim()
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
  const bucket         = load.wallet_bucket === 'bonus' ? 'bonus' : 'cash'
  const panelName      = load.game_accounts?.game_panels?.name || null
  const accountUsername = load.game_accounts?.game_username || null

  // ── REJECT ──────────────────────────────────────────────────────
  if (action === 'reject') {
    if (!reason) return res.status(400).json({ error: 'A rejection reason is required.' })
    // Give the money back. request_game_load takes the amount out of cash
    // and holds it in reserved_cents the moment the player asks, so a
    // rejection that only changed the status left the player short and the
    // reservation stuck on the wallet for ever.
    const { data: rw } = await supabaseAdmin
      .from('wallets').select('*').eq('user_id', playerId).single()

    if (rw) {
      const refundBucket = load.wallet_bucket === 'bonus' ? 'bonus' : 'cash'
      const holdCents = refundBucket === 'bonus' ? 0 : (load.withdrawable_hold_cents || 0)
      const afterCents = refundBucket === 'bonus'
        ? (rw.bonus_balance_cents || 0) + amountCents
        : (rw.cash_balance_cents || 0) + amountCents

      const refundUpdate = {
        reserved_cents: Math.max(0, (rw.reserved_cents || 0) - amountCents),
        updated_at:     new Date().toISOString(),
        version:        rw.version + 1,
      }
      if (refundBucket === 'bonus') {
        refundUpdate.bonus_balance_cents = (rw.bonus_balance_cents || 0) + amountCents
      } else {
        refundUpdate.cash_balance_cents = (rw.cash_balance_cents || 0) + amountCents
        refundUpdate.withdrawable_cents = (rw.withdrawable_cents || 0) + holdCents
      }
      await supabaseAdmin.from('wallets').update(refundUpdate)
        .eq('user_id', playerId).eq('version', rw.version)

      await supabaseAdmin.from('ledger').insert({
        tenant_id:           tenantId,
        reference_id:        `gl-refund-${load_id}`,
        user_id:             playerId,
        type:                'game_load_refund',
        wallet_bucket:       refundBucket,
        amount_cents:        amountCents,
        direction:           'credit',
        balance_after_cents: afterCents,
        game_load_id:        load_id,
        description:         panelName ? `Game load refunded — ${panelName} (${load.reference_id})` : `Game load ${load.reference_id} rejected — refunded`,
        created_by:          actor.id,
        idempotency_key:     `gl-refund-${load_id}`,
      }).then(() => {}, () => {})
    }

    const { error: rejectErr } = await supabaseAdmin
      .from('game_loads')
      .update({
        status:           'rejected',
        rejection_reason: reason,
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
      reason:      reason,
    })

    await supabaseAdmin.from('notifications').insert({
      tenant_id: tenantId, user_id: playerId, type: 'general',
      title: 'Scores Request Rejected',
      message: `Your scores request ${load.reference_id} was rejected. Reason: ${reason}`,
      reference_id: load.reference_id,
    }).then(() => {}, () => {})

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

  // The player's money has ALREADY left cash.
  //
  // request_game_load takes the amount out of cash_balance_cents and holds
  // it in reserved_cents when the player submits. This route then debited
  // cash a second time and never cleared the reservation — which is why a
  // $10 load cost $20 and left $10 reserved for ever.
  //
  // Approving releases the hold. It must not touch cash or bonus again.
  // The split across buckets is gone with it: the function only ever takes
  // cash, and refuses the request outright unless cash covers it.
  const cashUsed  = bucket === 'bonus' ? 0 : amountCents
  const bonusUsed = bucket === 'bonus' ? amountCents : 0

  const reserved = wallet.reserved_cents || 0
  if (reserved < amountCents) {
    // Older loads, made before the reservation existed, have nothing held.
    // Say so rather than quietly releasing a hold that was never taken.
    console.warn(`[game-loads/action] load ${load.reference_id}: reserved ${reserved} < amount ${amountCents}`)
  }

  const now = new Date().toISOString()
  const idempKey = `gl-approve-${load_id}`

  // Check idempotency
  const { data: existing } = await supabaseAdmin
    .from('ledger')
    .select('id')
    .eq('idempotency_key', idempKey)
    .maybeSingle()

  if (existing) return res.status(200).json({ ok: true, status: 'completed', idempotent: true })

  // Release the hold and record the load. Cash and bonus are untouched —
  // the money came out when the player asked.
  const walletUpdate = {
    reserved_cents:     Math.max(0, reserved - amountCents),
    total_loaded_cents: (wallet.total_loaded_cents || 0) + amountCents,
    updated_at:         now,
    version:            wallet.version + 1,
  }

  // One ledger row, in the bucket the money actually came from. The player
  // chose cash or bonus at request time; request_game_load took it from that
  // bucket and held it in reserved. The "After" balance shown in the wallet
  // must be that same bucket — a bonus-funded load showing the cash balance
  // was the bug.
  const afterCents = bucket === 'bonus' ? wallet.bonus_balance_cents : wallet.cash_balance_cents
  const ledgerRows = [{
    tenant_id:         tenantId,
    reference_id:      `${idempKey}-${bucket}`,
    user_id:           playerId,
    type:              'game_load',
    wallet_bucket:     bucket,
    amount_cents:      amountCents,
    direction:         'debit',
    // Unchanged by this step: the debit happened at request time.
    balance_after_cents: afterCents,
    game_load_id:      load_id,
    // The game's name, not just the reference. A player looking at their
    // wallet wants to know which game the money went into; LOAD-001008
    // told them nothing.
    description:       (panelName ? `Game load — ${panelName} (${load.reference_id})` : `Game load ${load.reference_id}`) + (bucket === 'bonus' ? ' · from Bonus' : ''),
    created_by:        actor.id,
    idempotency_key:   `${idempKey}-${bucket}`,
  }]

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
