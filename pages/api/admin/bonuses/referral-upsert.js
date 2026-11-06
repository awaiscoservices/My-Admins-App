/**
 * POST /api/admin/bonuses/referral-upsert
 * Update referral bonus % for deposit 1, 2, or 3. super_admin / admin only.
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
  if (!actor || !['super_admin', 'admin'].includes(actor.role)) return res.status(403).json({ error: 'Forbidden' })

  const { deposit_number, bonus_percent, is_active } = req.body
  if (!deposit_number || deposit_number < 1 || deposit_number > 3) {
    return res.status(400).json({ error: 'deposit_number must be 1, 2, or 3' })
  }

  const { error } = await supabaseAdmin
    .from('referral_bonus_tiers')
    .update({ bonus_percent: bonus_percent ?? 0, is_active: is_active ?? true, updated_at: new Date().toISOString() })
    .eq('deposit_number', deposit_number)

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin.from('audit_logs').insert({
    action: 'referral_bonus_update',
    performed_by: user.id,
    target_type: 'referral_bonus_tier',
    target_id: String(deposit_number),
    details: { deposit_number, bonus_percent },
  })

  return res.status(200).json({ success: true })
}
