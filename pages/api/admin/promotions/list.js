import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const gate = await guardAdmin(req, res, { allow: PERMS.PROMOS_READ })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { data, error } = await scopeToTenant(
    supabaseAdmin.from('promotions').select('*').order('created_at', { ascending: false }),
    gate,
  )
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ rows: data || [] })
}
