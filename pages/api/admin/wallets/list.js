/**
 * GET /api/admin/wallets/list?page=1&limit=25&search=foo
 * Returns wallets for the caller's own casino.
 * Super admins see wallets across all casinos.
 * Roles: super_admin, finance, support, risk, reporting
 */
import { guardAdmin, scopeToTenant, PERMS, safeSearchTerm } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.WALLETS_READ })
  if (!gate) return

  const { page = '1', limit = '25', search = '' } = req.query
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25))
  const offset = (pageNum - 1) * limitNum

  let query = gate.db
    .from('wallets')
    .select(`
      id, user_id, cash_balance_cents, bonus_balance_cents,
      total_deposited_cents, total_withdrawn_cents, updated_at,
      profiles!wallets_user_id_fkey(full_name, email, status)
    `, { count: 'exact' })
    .order('cash_balance_cents', { ascending: false })
    .range(offset, offset + limitNum - 1)

  query = scopeToTenant(query, gate)

  const term = safeSearchTerm(search)
  if (term) {
    query = query.or(`profiles.full_name.ilike.%${term}%,profiles.email.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    rows: data || [],
    total: count || 0,
    page: pageNum,
    pages: Math.ceil((count || 0) / limitNum),
  })
}
