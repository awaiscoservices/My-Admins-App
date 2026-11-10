/** GET /api/admin/browse?kind=wallets|transactions|adjustments|audit&q=&page=0  — read-only lists */
import { supabaseAdmin, requireStaff } from '../../../lib/adminApi'
import { BROWSE } from '../../../lib/adminSchemas'

const PAGE = 50

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const cfg = BROWSE[req.query.kind]
  if (!cfg) return res.status(400).json({ error: 'Unknown list' })
  const admin = await requireStaff(req, res, cfg.roles)
  if (!admin) return

  const page = Math.max(0, parseInt(req.query.page, 10) || 0)
  const q = String(req.query.q || '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 60)

  let query = supabaseAdmin.from(cfg.table).select('*', { count: 'exact' })
    .order(cfg.order, { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)

  // Scoped, or this generic browser returns every casino's rows.
  query = admin.scope(query)

  if (q && cfg.byAction) query = query.ilike('action', `%${q}%`)
  else if (q) {   // search by player name / email
    const safe = String(q).replace(/[^a-zA-Z0-9@._ -]/g, '').trim()
      const { data: found } = await admin.scope(supabaseAdmin.from('profiles').select('id')
        .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`).limit(200))
    const ids = (found || []).map(p => p.id)
    if (!ids.length) return res.status(200).json({ rows: [], total: 0, hasMore: false })
    query = query.in('user_id', ids)
  }

  const { data, error, count } = await query
  if (error) return res.status(500).json({ error: error.message })
  const rows = data || []

  // attach names: the player (user_id) and, for audit logs, the staff member (actor_id)
  const ids = [...new Set(rows.flatMap(r => [r.user_id, r.actor_id]).filter(Boolean))]
  const names = {}
  if (ids.length) {
    const { data: ps } = await supabaseAdmin.from('profiles').select('*').in('id', ids)
    for (const p of ps || []) names[p.id] = { name: p.full_name, email: p.email || null }
  }
  const out = rows.map(r => ({ ...r, _player: names[r.user_id] || null, _actor: names[r.actor_id] || null }))
  return res.status(200).json({ rows: out, total: count ?? out.length, hasMore: (count ?? 0) > page * PAGE + PAGE })
}
