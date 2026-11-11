/**
 * GET  /api/superadmin/defaults/sets          → every kind, with its rows
 * PUT  /api/superadmin/defaults/sets          → replace one kind { key, rows }
 * POST /api/superadmin/defaults/sets          → copy every kind from a casino
 *                                               { from_tenant_id }
 *
 * The one place the platform's starting configuration is read and written.
 */
import { guardSuperAdmin, supabaseAdmin } from '../_guard'
import { DEFAULT_KINDS, KIND_BY_KEY, readDefaults, writeDefaults, stripRow } from '../../../../lib/platformDefaults'

export default async function handler(req, res) {
  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const sets = {}
    for (const kind of DEFAULT_KINDS) {
      const { rows, updated_at } = await readDefaults(supabaseAdmin, kind.key)
      sets[kind.key] = { label: kind.label, rows, updated_at }
    }

    // What each casino actually holds, so the page can show who is missing what.
    const { data: tenants } = await supabaseAdmin
      .from('tenants').select('id, name').order('created_at')

    const coverage = []
    for (const t of tenants || []) {
      const counts = {}
      for (const kind of DEFAULT_KINDS) {
        const { count } = await supabaseAdmin
          .from(kind.table).select('*', { count: 'exact', head: true }).eq('tenant_id', t.id)
        counts[kind.key] = count || 0
      }
      coverage.push({ id: t.id, name: t.name, counts })
    }

    return res.status(200).json({ sets, coverage, kinds: DEFAULT_KINDS.map(k => ({ key: k.key, label: k.label })) })
  }

  if (req.method === 'PUT') {
    const { key, rows } = req.body || {}
    const kind = KIND_BY_KEY[key]
    if (!kind) return res.status(400).json({ error: 'Unknown kind' })
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' })
    if (rows.length > 200) return res.status(400).json({ error: 'That is more rows than a casino can use' })

    const clean = rows.map(r => stripRow(kind, r))
    const { error } = await writeDefaults(supabaseAdmin, key, clean, admin.id)
    if (error) return res.status(500).json({ error: error.message })

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id, actor_role: admin.role,
      action: 'platform_defaults_updated', target_type: 'platform_defaults', target_id: key,
      description: `Default ${kind.label} set to ${clean.length} row${clean.length === 1 ? '' : 's'}`,
    }).then(() => {}, () => {})

    return res.status(200).json({ ok: true, key, rows: clean })
  }

  if (req.method === 'POST') {
    const { from_tenant_id } = req.body || {}
    if (!from_tenant_id) return res.status(400).json({ error: 'Pick a casino to copy from' })

    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('id, name').eq('id', from_tenant_id).maybeSingle()
    if (!tenant) return res.status(404).json({ error: 'That casino does not exist' })

    const copied = {}
    for (const kind of DEFAULT_KINDS) {
      const { data: rows, error } = await supabaseAdmin
        .from(kind.table).select('*').eq('tenant_id', from_tenant_id).order(kind.order, { ascending: true })

      if (error) { copied[kind.key] = { count: 0, reason: error.message }; continue }
      if (!rows?.length) { copied[kind.key] = { count: 0, reason: `${tenant.name} has none` }; continue }

      const clean = rows.map(r => stripRow(kind, r))
      const { error: saveErr } = await writeDefaults(supabaseAdmin, kind.key, clean, admin.id)
      copied[kind.key] = saveErr ? { count: 0, reason: saveErr.message } : { count: clean.length }
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id, actor_role: admin.role,
      action: 'platform_defaults_imported', target_type: 'platform_defaults', target_id: 'all',
      description: `Defaults copied from ${tenant.name}`,
    }).then(() => {}, () => {})

    return res.status(200).json({ ok: true, from: tenant.name, copied })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
