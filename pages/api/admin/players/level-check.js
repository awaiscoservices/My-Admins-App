/**
 * POST /api/admin/players/level-check
 * Manually trigger a level check for a specific player.
 * The DB trigger handles auto-upgrades on XP changes, but this endpoint
 * lets admins force a re-check (e.g. after manual XP adjustments).
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: admin } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()

  if (!admin || !['super_admin', 'support', 'finance'].includes(admin.role))
    return res.status(403).json({ error: 'Insufficient permissions' })

  const { player_id } = req.body
  if (!player_id) return res.status(400).json({ error: 'player_id required' })

  // Only act on a player in the caller's own casino.
  const { data: me } = await supabaseAdmin.from('profiles').select('tenant_id, role').eq('id', user.id).single()
  if (me?.role !== 'super_admin') {
    const { data: owned } = await supabaseAdmin
      .from('profiles').select('id').eq('id', player_id).eq('tenant_id', me?.tenant_id).maybeSingle()
    if (!owned) return res.status(404).json({ error: 'Player not found' })
  }

  // Use the DB function to check and upgrade if needed
  const { data, error } = await supabaseAdmin.rpc('check_and_upgrade_player_level', {
    p_user_id: player_id,
  })

  if (error) {
    console.error('Level check error:', error)
    return res.status(500).json({ error: 'Level check failed', detail: error.message })
  }

  return res.status(200).json({
    message: 'Level check completed',
    result: data,
  })
}
