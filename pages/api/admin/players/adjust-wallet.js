/**
 * POST /api/admin/players/adjust-wallet
 * Apply a manual wallet adjustment with full ledger entry + audit log.
 * Admin CANNOT set a balance directly — only adjust with a reason.
 */
import { guardAdmin, scopeToTenant, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PLAYER_WALLET_ADJUST })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { player_id, direction, wallet_bucket, amount_cents, reason, case_reference } = req.body

  // Validate
  if (!player_id) return res.status(400).json({ error: 'player_id required' })
  if (!['credit', 'debit'].includes(direction)) return res.status(400).json({ error: 'Invalid direction' })
  if (!['cash', 'bonus'].includes(wallet_bucket)) return res.status(400).json({ error: 'Invalid wallet_bucket' })
  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0 || !Number.isInteger(amount_cents))
    return res.status(400).json({ error: 'Invalid amount_cents' })
  if (!reason?.trim()) return res.status(400).json({ error: 'Reason is required' })

  // Resolve + tenant-scope the wallet first (cheap 404 + tenant for a non-owned wallet).
  // The actual money movement runs atomically inside wallet_adjust_atomic().
  let walletQ = supabaseAdmin.from('wallets').select('tenant_id, user_id').eq('user_id', player_id)
  walletQ = scopeToTenant(walletQ, gate)
  const { data: wallet } = await walletQ.maybeSingle()
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' })
  const tenantId = tenantOf(wallet, gate)

  // ── Atomic: wallet update + ledger + adjustment + audit, all-or-nothing ──
  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('wallet_adjust_atomic', {
    p_user_id:       player_id,
    p_tenant:        tenantId,
    p_bucket:        wallet_bucket,
    p_direction:     direction,
    p_amount_cents:  amount_cents,
    p_reason:        reason,
    p_case_reference: case_reference || null,
    p_admin:         admin.id,
    p_actor_role:    admin.role,
    p_idempotency_key: null,
  })
  if (rpcErr) {
    const insufficient = /insufficient/i.test(rpcErr.message)
    return res.status(insufficient ? 400 : 409).json({ error: rpcErr.message })
  }

  // ── Best-effort: notify player (never rolls back the committed adjustment) ──
  await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId,
    user_id: player_id,
    title: `Wallet ${direction === 'credit' ? 'Credited' : 'Adjusted'}`,
    message: `Your ${wallet_bucket} wallet has been ${direction === 'credit' ? 'credited' : 'debited'} $${(amount_cents / 100).toFixed(2)}. Reference: ${result.reference_id}.`,
  }).then(() => {}, () => {})

  return res.status(200).json({
    message: `Wallet ${direction}ed successfully`,
    reference_id: result.reference_id,
    new_balance_cents: result.new_balance_cents,
  })
}
