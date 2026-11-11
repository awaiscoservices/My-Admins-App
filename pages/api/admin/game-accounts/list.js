/**
 * GET /api/admin/game-accounts/list?status=pending&search=foo
 * Returns game accounts for admin — bypasses RLS using service role key.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.GAME_ACCOUNTS_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { status } = req.query

  let query = supabaseAdmin
    .from('game_accounts')
    .select('*, profiles!game_accounts_user_id_fkey(full_name, email, kyc_status, status), game_panels!game_accounts_game_panel_id_fkey(name, accent_color)')
    .order('created_at', { ascending: true })
    .limit(100)

  query = scopeToTenant(query, gate)

  // 'password' is not a status — it is the players waiting on a new game
  // password, which leaves the account active while it is outstanding.
  if (status === 'password') {
    query = query.eq('password_change_requested', true)
  } else if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    console.error('game-accounts list error:', error)
    return res.status(500).json({ error: 'Failed to load game accounts' })
  }

  return res.status(200).json({ accounts: data || [] })
}
