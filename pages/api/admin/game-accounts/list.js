/**
 * GET /api/admin/game-accounts/list?status=pending&search=foo
 * Returns game accounts for admin — bypasses RLS using service role key.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Verify admin role
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'player') return res.status(403).json({ error: 'Forbidden' })

  const { status } = req.query

  let query = supabaseAdmin
    .from('game_accounts')
    .select('*, profiles!game_accounts_user_id_fkey(full_name, email, kyc_status, status), game_panels!game_accounts_game_panel_id_fkey(name, accent_color)')
    .order('created_at', { ascending: true })
    .limit(100)

  query = scopeToTenant(query, gate)

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('game-accounts list error:', error)
    return res.status(500).json({ error: 'Failed to load game accounts' })
  }

  return res.status(200).json({ accounts: data || [] })
}
