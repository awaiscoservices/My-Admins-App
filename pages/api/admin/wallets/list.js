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

  // !inner so the filter below applies: only players appear here.
  //
  // A wallet is created for every account, staff included, so this page was
  // listing admins and super admins alongside players — rows that are always
  // zero and that nobody can act on.
  let query = gate.db
    .from('wallets')
    .select(`
      id, user_id, cash_balance_cents, bonus_balance_cents,
      total_deposited_cents, total_withdrawn_cents,
      total_loaded_cents, total_redeemed_cents, updated_at,
      profiles!inner(full_name, email, status, role, player_levels(name, accent_color))
    `, { count: 'exact' })
    .eq('profiles.role', 'player')
    .order('cash_balance_cents', { ascending: false })
    .range(offset, offset + limitNum - 1)

  // The wallet's own casino, and the owner's. A wallet is stamped with the
  // casino it was created under, which has been wrong for accounts made
  // before that was fixed — so a staff member only sees a wallet when BOTH
  // agree with their own casino.
  query = scopeToTenant(query, gate)
  if (!gate.isSuperAdmin) query = query.eq('profiles.tenant_id', gate.tenantId)

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
