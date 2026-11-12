import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.NOTIFY_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { status, type, page = '1', limit = '50' } = req.query
  const pageNum = Math.max(1, parseInt(page))
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
  const offset = (pageNum - 1) * limitNum

  let query = supabaseAdmin
    .from('notifications')
    .select('id, user_id, title, message, is_read, created_at, profiles!notifications_user_id_fkey(id, username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1)

  query = scopeToTenant(query, gate)

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
    user_name: n.profiles?.username || null,
    user_email: null,
    profiles: undefined,
  }))

  return res.status(200).json({
    rows: normalized,
    total: count || 0,
    page: pageNum,
    pages: Math.ceil((count || 0) / limitNum),
  })
}
