/**
 * GET /api/admin/players/list?status=active&search=foo&page=1&limit=25
 *
 * Lists player profiles belonging to the caller's own casino.
 * Super admins see players across all casinos.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'
import { maskPlayer } from '../../../../lib/playerLabel'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Verifies the token, checks the role, and resolves the caller's casino.
  const gate = await guardAdmin(req, res, { allow: PERMS.PLAYERS_READ })
  if (!gate) return

  const { page = '1', limit = '25', search = '', status = '' } = req.query
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25))
  const offset = (pageNum - 1) * limitNum

  let query = gate.db
    .from('profiles')
    .select('id, username, phone, status, kyc_status, player_level_id, created_at, last_login_at', { count: 'exact' })
    .eq('role', 'player')
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1)

  // The line that stops one casino's staff seeing another casino's players.
  query = scopeToTenant(query, gate)

  if (status) query = query.eq('status', status)

  if (search) {
    // Commas, parentheses and dots are separators inside an .or() filter, so a
    // search term containing them could change the filter's meaning. Strip them.
    const safe = String(search).replace(/[,()."%\\]/g, '').trim()
    if (safe) {
      // Staff search by the player's username slug only — real name and email
      // are never exposed to them, so they can't be searched either.
      query = query.ilike('username', `%${safe}%`)
    }
  }

  const { data, error, count } = await query
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    rows: (data || []).map(maskPlayer),
    total: count || 0,
    page: pageNum,
    pages: Math.ceil((count || 0) / limitNum),
  })
}
