import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.AUDIT_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  // page is 0-based. limit rows per page.
  const page   = Math.max(0, parseInt(req.query.page, 10) || 0)
  const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100))
  const search = (req.query.search || '').toString()
  const offset = page * limit

  // The actor's name/email comes from profiles via the actor_id FK.
  // (The column is `description`, not `details`, and the role is stored on
  // the row as `actor_role` — selecting a non-existent column 500s the page.)
  let q = supabaseAdmin.from('audit_logs')
    .select(
      'id, action, target_type, target_id, description, actor_role, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name, email, role)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  q = scopeToTenant(q, gate)

  if (search) q = q.ilike('action', `%${search}%`)

  const { data, count, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ rows: data || [], total: count || 0 })
}
