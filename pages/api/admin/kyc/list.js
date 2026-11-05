/**
 * GET /api/admin/kyc/list?status=pending
 * Service-role only — bypasses RLS.
 * Uses explicit FK hint to avoid "more than one relationship" error.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'kyc_agent', 'risk']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role))
    return res.status(403).json({ error: 'Insufficient permissions' })

  const { status = 'all' } = req.query

  // Explicit FK hint resolves "more than one relationship" error:
  //   kyc_records_user_id_fkey     → the player
  //   kyc_records_reviewed_by_fkey → the reviewer (not embedded here)
  let q = supabaseAdmin
    .from('kyc_records')
    .select(`
      id, status, document_type, document_url, submitted_at, reviewed_at, rejection_reason,
      profiles!kyc_records_user_id_fkey ( id, full_name, email, kyc_status )
    `)
    .order('submitted_at', { ascending: false })
    .limit(100)

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ data })
}
