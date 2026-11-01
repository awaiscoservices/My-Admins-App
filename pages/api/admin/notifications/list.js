import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'support', 'finance', 'risk', 'kyc_agent', 'game_ops']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) return res.status(401).json({ error: 'Profile not found' })
  if (!ALLOWED_ROLES.includes(profile.role)) return res.status(403).json({ error: 'Forbidden' })

  const { status, type, page = '1', limit = '50' } = req.query
  const pageNum = Math.max(1, parseInt(page))
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
  const offset = (pageNum - 1) * limitNum

  let query = supabaseAdmin
    .from('notifications')
    .select('id, user_id, title, message, is_read, created_at, profiles!notifications_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1)

  if (status === 'unread') query = query.eq('is_read', false)
  if (status === 'read') query = query.eq('is_read', true)

  const { data: rows, error: listErr, count } = await query

  if (listErr) {
    console.error('notifications list error:', listErr)
    return res.status(500).json({ error: 'Failed to fetch notifications', detail: listErr.message })
  }

  // Flatten profile join — if FK alias fails, row still returns without profile
  const normalized = (rows || []).map(n => ({
    ...n,
    user_name: n.profiles?.full_name || null,
    user_email: n.profiles?.email || null,
    profiles: undefined,
  }))

  return res.status(200).json({
    rows: normalized,
    total: count || 0,
    page: pageNum,
    pages: Math.ceil((count || 0) / limitNum),
  })
}
