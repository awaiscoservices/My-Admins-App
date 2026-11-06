/**
 * POST /api/admin/bonuses/delete
 * Delete a player bonus tier. super_admin only.
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

  const { data: actor } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!actor || actor.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'id is required' })

  const { error } = await supabaseAdmin.from('player_bonuses').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('audit_logs').insert({
    action: 'bonus_tier_delete',
    performed_by: user.id,
    target_type: 'player_bonus',
    target_id: id,
    details: {},
  })

  return res.status(200).json({ success: true })
}
