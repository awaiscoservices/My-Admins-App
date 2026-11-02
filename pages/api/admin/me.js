/**
 * GET /api/admin/me
 * Returns the logged-in staff member's own profile details for the header dropdown.
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

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, phone, created_at')
    .eq('id', user.id)
    .single()

  if (error || !profile || profile.role === 'player') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  return res.status(200).json({ profile })
}
