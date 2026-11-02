/**
 * GET /api/admin/pending-counts
 * Returns 6 pending-queue counts for the header notification badges.
 * Uses service role to bypass RLS — counts only, no payload data exposed.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || profile.role === 'player') return res.status(403).json({ error: 'Forbidden' })

  const [deposits, withdrawals, scores, redeems, kyc, games] = await Promise.all([
    supabaseAdmin.from('deposits').select('*',     { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('withdrawals').select('*',  { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('game_loads').select('*',   { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('redemptions').select('*',  { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('kyc_records').select('*',  { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('game_accounts').select('*',{ count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return res.status(200).json({
    deposit_requests:  deposits.count   || 0,
    withdraw_requests: withdrawals.count || 0,
    scores_requests:   scores.count     || 0,
    redeem_requests:   redeems.count    || 0,
    kyc_requests:      kyc.count        || 0,
    game_requests:     games.count      || 0,
  })
}
