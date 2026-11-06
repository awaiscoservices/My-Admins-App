/**
 * POST /api/admin/bonuses/cell-upsert
 * Save a single bonus cell: payment_method + level + day → bonus_percent.
 * Pass bonus_percent: null to delete the row (clear the cell).
 * super_admin / admin only.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED = ['super_admin', 'admin']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !ALLOWED.includes(actor.role)) return res.status(403).json({ error: 'Forbidden' })

  const { payment_method_id, player_level_id, day_number, bonus_percent } = req.body

  if (!payment_method_id) return res.status(400).json({ error: 'payment_method_id required' })
  if (!player_level_id)   return res.status(400).json({ error: 'player_level_id required' })
  if (!day_number || day_number < 1 || day_number > 7) return res.status(400).json({ error: 'day_number must be 1–7' })

  // null means clear the cell → delete the row
  if (bonus_percent === null || bonus_percent === undefined) {
    const { error } = await supabaseAdmin
      .from('player_bonuses')
      .delete()
      .eq('payment_method_id', payment_method_id)
      .eq('player_level_id', player_level_id)
      .eq('day_number', day_number)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true, deleted: true })
  }

  const pct = parseFloat(bonus_percent)
  if (isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'bonus_percent must be 0–100' })

  // Upsert by the unique triple
  const { error } = await supabaseAdmin
    .from('player_bonuses')
    .upsert({
      payment_method_id,
      player_level_id,
      day_number,
      bonus_percent: pct,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'payment_method_id,player_level_id,day_number',
    })

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('audit_logs').insert({
    action: 'bonus_cell_upsert',
    performed_by: user.id,
    target_type: 'player_bonus',
    details: { payment_method_id, player_level_id, day_number, bonus_percent: pct },
  })

  return res.status(200).json({ success: true })
}
