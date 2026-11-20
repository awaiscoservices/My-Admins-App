import { guardAdmin, scopeToTenant, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.WALLETS_ADJUST })
  if (!gate) return
  const supabaseAdmin = gate.db
  const actor = gate.actor

  const { user_id, amount_cents, direction, reason } = req.body
  if (!user_id || !amount_cents || !direction || !reason?.trim()) return res.status(400).json({ error: 'user_id, amount_cents, direction, reason required' })
  if (!['credit', 'debit'].includes(direction)) return res.status(400).json({ error: 'direction must be credit or debit' })
  if (!Number.isInteger(amount_cents) || amount_cents <= 0) return res.status(400).json({ error: 'amount_cents must be positive integer' })

  // Resolve + tenant-scope the wallet first (cheap 404 + tenant for a non-owned wallet).
  // This route adjusts the cash bucket only. The money movement runs atomically inside
  // wallet_adjust_atomic() — wallet update + ledger + adjustment + audit, all-or-nothing.
  let walletQ = supabaseAdmin.from('wallets').select('tenant_id, user_id').eq('user_id', user_id)
  walletQ = scopeToTenant(walletQ, gate)
  const { data: wallet, error: walletErr } = await walletQ.maybeSingle()
  if (walletErr || !wallet) return res.status(404).json({ error: 'Wallet not found' })
  const tenantId = tenantOf(wallet, gate)

  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('wallet_adjust_atomic', {
    p_user_id:        user_id,
    p_tenant:         tenantId,
    p_bucket:         'cash',
    p_direction:      direction,
    p_amount_cents:   amount_cents,
    p_reason:         reason,
    p_case_reference: null,
    p_admin:          actor.id,
    p_actor_role:     actor.role,
    p_idempotency_key: null,
  })
  if (rpcErr) {
    const insufficient = /insufficient/i.test(rpcErr.message)
    return res.status(insufficient ? 400 : 409).json({ error: rpcErr.message })
  }

  // Best-effort: notify player (never rolls back the committed adjustment)
  await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId,
    user_id,
    title: direction === 'credit' ? '💰 Wallet Credited' : '💸 Wallet Debited',
    message: `Your wallet has been ${direction === 'credit' ? 'credited' : 'debited'} $${(amount_cents / 100).toFixed(2)}. Ref: ${result.reference_id}`,
  }).then(() => {}, () => {})

  return res.status(200).json({ success: true, reference_id: result.reference_id, new_balance_cents: result.new_balance_cents })
}
