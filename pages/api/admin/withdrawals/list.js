/**
 * GET /api/admin/withdrawals/list?status=pending
 * Returns withdrawals for the caller's own casino.
 * Super admins see withdrawals across all casinos.
 * Uses explicit FK hints to avoid "more than one relationship" error.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'
import { maskPlayer } from '../../../../lib/playerLabel'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.WITHDRAWALS_READ })
  if (!gate) return

  const { status = 'all' } = req.query

  // Explicit FK hints resolve "more than one relationship" error:
  //   withdrawals_user_id_fkey      → the player
  //   withdrawals_processed_by_fkey → the reviewer (not embedded here)
  let q = gate.db
    .from('withdrawals')
    .select(`
      id, reference_id, amount_cents, status, created_at, admin_notes, reviewed_at, rejection_reason,
      payment_method_id, user_id, method, destination, payout_label,
      profiles!withdrawals_user_id_fkey ( id, username ),
      player_levels ( name, daily_withdrawal_limit_cents )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  q = scopeToTenant(q, gate)

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })

  // ── Payout-tag fraud signal ────────────────────────────────────────────────
  // How many DISTINCT player accounts in this casino have ever used the same
  // payout (method + tag). One tag shared across many accounts is a classic
  // multi-account / fraud pattern, so we surface the count on every row.
  // Scoped to the caller's casino (tenant) and grouped by method + tag.
  let tagQ = gate.db.from('withdrawals').select('user_id, method, destination').limit(5000)
  tagQ = scopeToTenant(tagQ, gate)
  const { data: allWd } = await tagQ

  const norm = s => (s || '').trim().toLowerCase()
  const key  = (method, tag) => norm(method) + '|' + norm(tag)
  const tagUsers = new Map()               // "method|tag" → Set(user_id)
  for (const w of allWd || []) {
    if (!w.destination) continue
    const k = key(w.method, w.destination)
    if (!tagUsers.has(k)) tagUsers.set(k, new Set())
    tagUsers.get(k).add(w.user_id)
  }
  const countFor = r => (r.destination ? (tagUsers.get(key(r.method, r.destination))?.size || 0) : 0)

  return res.status(200).json({
    data: (data || []).map(r => ({ ...r, profiles: maskPlayer(r.profiles), tag_account_count: countFor(r) })),
  })
}
