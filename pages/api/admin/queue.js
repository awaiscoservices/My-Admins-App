/**
 * GET /api/admin/queue?kind=withdrawals&view=open|done|all
 * Lists requests for one admin queue, with player + game details attached.
 */
import { supabaseAdmin, requireStaff, QUEUES, OPEN_STATUSES } from '../../../lib/adminApi'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { kind, view = 'open' } = req.query
  const cfg = QUEUES[kind]
  if (!cfg) return res.status(400).json({ error: 'Unknown queue' })

  const admin = await requireStaff(req, res, cfg.roles)
  if (!admin) return

  const open = OPEN_STATUSES[kind]
  // Scoped, or every casino's queue shows in every casino's panel.
  let q = admin.scope(supabaseAdmin.from(cfg.table).select('*').order('created_at', { ascending: view === 'open' }).limit(100))
  if (view === 'open') q = q.in('status', open)
  else if (view === 'done') q = q.not('status', 'in', `(${open.join(',')})`)

  const { data: rows, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  const list = rows || []

  // players
  const userIds = [...new Set(list.map(r => r.user_id).filter(Boolean))]
  const players = {}
  if (userIds.length) {
    const { data } = await supabaseAdmin.from('profiles').select('*').in('id', userIds)
    for (const p of data || []) players[p.id] = { id: p.id, name: p.full_name, email: p.email || null, phone: p.phone || null }
  }

  // game account + game name (looked up separately so it works with or without a foreign key)
  const accountIds = [...new Set(list.map(r => r.game_account_id).filter(Boolean))]
  const games = {}
  if (accountIds.length) {
    const { data: accs } = await supabaseAdmin.from('game_accounts').select('id, game_username, game_panel_id').in('id', accountIds)
    const panelIds = [...new Set((accs || []).map(a => a.game_panel_id).filter(Boolean))]
    const panels = {}
    if (panelIds.length) {
      const { data } = await supabaseAdmin.from('game_panels').select('id, name').in('id', panelIds)
      for (const p of data || []) panels[p.id] = p.name
    }
    for (const a of accs || []) games[a.id] = { name: panels[a.game_panel_id] || 'Game', username: a.game_username }
  }

  // temporary links to the ID photos (private bucket, valid 5 minutes)
  async function signed(path) {
    if (!path) return null
    const { data } = await supabaseAdmin.storage.from('kyc-documents').createSignedUrl(path, 300)
    return data?.signedUrl || null
  }

  const out = []
  for (const r of list) {
    const item = { ...r, _player: players[r.user_id] || null, _game: games[r.game_account_id] || null }
    if (kind === 'kyc') item._docs = { front: await signed(r.front_path), back: await signed(r.back_path) }
    out.push(item)
  }
  return res.status(200).json({ rows: out })
}
