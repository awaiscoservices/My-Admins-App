/**
 * GET /api/admin/deposits/list
 * Returns deposits with player info. Uses service role to bypass RLS.
 * Roles: super_admin, admin, finance
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'finance']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: actor } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (!actor || !ALLOWED_ROLES.includes(actor.role))
    return res.status(403).json({ error: 'Forbidden' })

  const { status } = req.query

  let q = supabaseAdmin
    .from('deposits')
    .select(`
      id, reference_id, amount_cents, bonus_cents, total_credit_cents,
      status, player_reference, screenshot_url, player_notes, admin_notes,
      rejection_reason, created_at, reviewed_at,
      payment_method_id,
      profiles!deposits_user_id_fkey ( id, full_name, email )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ deposits: data || [] })
}
