/**
 * GET /api/admin/transactions/list?page=0&limit=25&search=&type=
 * Returns ledger entries for the caller's own casino.
 * Super admins see entries across all casinos.
 * Roles: super_admin, finance, reporting, support
 *
 * Note: `page` here is 0-based.
 */
import { guardAdmin, scopeToTenant, PERMS, safeSearchTerm } from '../../../../lib/adminGuard'
import { maskPlayer } from '../../../../lib/playerLabel'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.TRANSACTIONS_READ })
  if (!gate) return

  const { page = 0, limit = 25, search = '', type = '' } = req.query
  const pageNum = Math.max(0, parseInt(page) || 0)
  const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 25))
  const offset = pageNum * limitNum

  let q = gate.db
    .from('ledger')
    .select('id, type, direction, wallet_bucket, amount_cents, balance_after_cents, reference_id, description, created_at, profiles!ledger_user_id_fkey(id, username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1)

  q = scopeToTenant(q, gate)

  if (type) q = q.eq('type', type)

  const term = safeSearchTerm(search)
  if (term) q = q.ilike('reference_id', `%${term}%`)

  const { data, count, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ rows: (data || []).map(r => ({ ...r, profiles: maskPlayer(r.profiles) })), total: count || 0 })
}
