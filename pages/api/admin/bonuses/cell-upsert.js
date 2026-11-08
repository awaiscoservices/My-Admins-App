/**
 * pages/api/admin/bonuses/cell-upsert.js
 *
 * POST { payment_method_id, player_level_id, day_number, bonus_percent }
 *   bonus_percent null → delete the row (no bonus)
 *   bonus_percent 0–100 → upsert
 *
 * Admin-only.
 */
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUser = createServerSupabaseClient({ req, res })
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('is_staff')
    .eq('id', user.id)
    .single()

  if (!profile?.is_staff) return res.status(403).json({ error: 'Forbidden' })

  const { payment_method_id, player_level_id, day_number, bonus_percent } = req.body

  if (!payment_method_id || !player_level_id || !day_number) {
    return res.status(400).json({ error: 'payment_method_id, player_level_id, day_number required' })
  }

  if (bonus_percent === null || bonus_percent === undefined) {
    // Delete: clear the bonus for this cell
    const { error } = await admin
      .from('player_bonuses')
      .delete()
      .eq('payment_method_id', payment_method_id)
      .eq('player_level_id', player_level_id)
      .eq('day_number', day_number)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, action: 'deleted' })
  }

  const pct = parseFloat(bonus_percent)
  if (isNaN(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'bonus_percent must be 0–100' })
  }

  // Build a name for the row
  const { data: pm } = await admin.from('payment_methods').select('name').eq('id', payment_method_id).single()
  const { data: lv } = await admin.from('player_levels').select('name').eq('id', player_level_id).single()
  const name = `${pm?.name || payment_method_id} - ${lv?.name || player_level_id} - Day ${day_number}`

  const { error } = await admin
    .from('player_bonuses')
    .upsert(
      { payment_method_id, player_level_id, day_number, bonus_percent: pct, name },
      { onConflict: 'payment_method_id,player_level_id,day_number' }
    )

  if (error) {
    console.error('[cell-upsert]', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true, action: 'upserted' })
}
