/**
 * /api/internal/conversations — internal staff Support inbox.
 *
 * GET   → { threads, contacts }
 *           threads  : conversations I'm in, newest first, with label, unread,
 *                      last-message preview, starred flag.
 *           contacts : people/threads I can start that have no thread yet
 *                      (teammates to DM; for a super admin, casinos to open).
 * POST  → { conversation }  find-or-create a thread.
 *           body { kind:'dm', otherUserId }         → DM with a teammate
 *           body { kind:'platform', tenantId? }     → the casino's platform thread
 * PATCH → { ok }  toggle a star.  body { conversationId, is_starred }
 *
 * Everything is tenant-scoped the same way the player chat is: a super admin
 * sees every casino's platform thread (one inbox for the whole platform); a
 * tenant staff member sees their own casino's platform thread plus their DMs.
 */
import { guardAdmin, PERMS } from '../../../lib/adminGuard'

const STAFF_ROLES = ['admin', 'finance', 'support', 'risk', 'kyc_agent', 'game_ops', 'reporting', 'marketing']

function staffLabel(p) {
  return p?.full_name || p?.username || p?.email || 'Staff'
}
function roleLabel(role) {
  return String(role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function preview(m) {
  if (!m) return ''
  if (m.body) return m.body
  if (m.file_name) return `📎 ${m.file_name}`
  if (m.file_url) return '📎 Attachment'
  return ''
}

export default async function handler(req, res) {
  const gate = await guardAdmin(req, res, { allow: PERMS.INTERNAL_CHAT })
  if (!gate) return

  const { db, actor, isSuperAdmin } = gate
  const me = actor.id

  if (req.method === 'GET')    return getInbox(req, res, gate, { me, isSuperAdmin })
  if (req.method === 'POST')   return openThread(req, res, gate, { me, isSuperAdmin })
  if (req.method === 'PATCH')  return setStar(req, res, db, me)
  return res.status(405).end()
}

async function getInbox(req, res, gate, { me, isSuperAdmin }) {
  const { db } = gate

  // 1. Conversations visible to the caller.
  let convQ = db.from('internal_conversations').select('*')
  if (isSuperAdmin) {
    convQ = convQ.eq('kind', 'platform')
  } else {
    convQ = convQ
      .eq('tenant_id', gate.tenantId)
      .or(`kind.eq.platform,a_user_id.eq.${me},b_user_id.eq.${me}`)
  }
  const { data: convs = [] } = await convQ.order('last_message_at', { ascending: false, nullsFirst: false })

  const convIds = convs.map(c => c.id)

  // 2. My read/star state for those conversations.
  const readMap = {}
  if (convIds.length) {
    const { data: reads = [] } = await db
      .from('internal_reads').select('conversation_id, last_read_at, is_starred')
      .eq('user_id', me).in('conversation_id', convIds)
    for (const r of reads) readMap[r.conversation_id] = r
  }

  // 3. Last message + unread count per conversation.
  const lastMap = {}
  const unreadMap = {}
  if (convIds.length) {
    const { data: msgs = [] } = await db
      .from('internal_messages')
      .select('conversation_id, sender_id, body, file_url, file_name, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(600)
    for (const m of msgs) {
      if (!lastMap[m.conversation_id]) lastMap[m.conversation_id] = m
      const readAt = readMap[m.conversation_id]?.last_read_at
      const isUnread = m.sender_id !== me && (!readAt || new Date(m.created_at) > new Date(readAt))
      if (isUnread) unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1
    }
  }

  // 4. Labels. Collect the profile ids and tenant ids we need to name.
  const otherUserIds = new Set()
  const tenantIds = new Set()
  for (const c of convs) {
    if (c.kind === 'dm') otherUserIds.add(c.a_user_id === me ? c.b_user_id : c.a_user_id)
    if (c.kind === 'platform' && isSuperAdmin) tenantIds.add(c.tenant_id)
  }
  const profMap = await loadProfiles(db, [...otherUserIds])
  const tenantMap = await loadTenants(db, [...tenantIds])

  const threads = convs.map(c => {
    let label, sublabel = null, otherUserId = null
    if (c.kind === 'platform') {
      if (isSuperAdmin) { label = tenantMap[c.tenant_id] || 'Casino'; sublabel = 'Platform support' }
      else              { label = 'Platform Support'; sublabel = 'Help from the platform' }
    } else {
      otherUserId = c.a_user_id === me ? c.b_user_id : c.a_user_id
      const p = profMap[otherUserId]
      label = staffLabel(p); sublabel = roleLabel(p?.role)
    }
    const last = lastMap[c.id]
    return {
      id: c.id, kind: c.kind, tenant_id: c.tenant_id, otherUserId,
      label, sublabel,
      last_message: preview(last),
      last_message_at: last?.created_at || c.last_message_at,
      last_from_me: last ? last.sender_id === me : false,
      unread: unreadMap[c.id] || 0,
      is_starred: !!readMap[c.id]?.is_starred,
    }
  })

  // 5. Contacts with no thread yet.
  const contacts = []
  if (isSuperAdmin) {
    const haveTenant = new Set(convs.map(c => c.tenant_id))
    const { data: tenants = [] } = await db.from('tenants').select('id, name').order('name')
    for (const t of tenants) {
      if (!haveTenant.has(t.id)) contacts.push({ type: 'platform', tenantId: t.id, label: t.name || 'Casino', sublabel: 'Platform support' })
    }
  } else {
    const haveUser = new Set(threads.filter(t => t.kind === 'dm').map(t => t.otherUserId))
    const havePlatform = threads.some(t => t.kind === 'platform')
    if (!havePlatform) contacts.push({ type: 'platform', tenantId: gate.tenantId, label: 'Platform Support', sublabel: 'Help from the platform' })
    const { data: mates = [] } = await db
      .from('profiles').select('id, full_name, username, email, role')
      .eq('tenant_id', gate.tenantId).in('role', STAFF_ROLES).neq('id', me).order('full_name')
    for (const p of mates) {
      if (!haveUser.has(p.id)) contacts.push({ type: 'dm', userId: p.id, label: staffLabel(p), sublabel: roleLabel(p.role) })
    }
  }

  return res.status(200).json({ threads, contacts, me })
}

async function openThread(req, res, gate, { me, isSuperAdmin }) {
  const { db } = gate
  const { kind, otherUserId, tenantId } = req.body || {}

  if (kind === 'platform') {
    const tid = isSuperAdmin ? tenantId : gate.tenantId
    if (!tid) return res.status(400).json({ error: 'tenantId required' })
    const existing = await db.from('internal_conversations').select('*').eq('tenant_id', tid).eq('kind', 'platform').maybeSingle()
    if (existing.data) return res.status(200).json({ conversation: existing.data })
    const { data, error } = await db.from('internal_conversations')
      .insert({ tenant_id: tid, kind: 'platform' }).select('*').single()
    if (error) return res.status(500).json({ error: 'Could not open thread' })
    return res.status(200).json({ conversation: data })
  }

  if (kind === 'dm') {
    if (isSuperAdmin) return res.status(400).json({ error: 'Super admin uses platform threads' })
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId required' })
    // The other party must be a teammate in my casino.
    const { data: mate } = await db.from('profiles').select('id, tenant_id, role').eq('id', otherUserId).maybeSingle()
    if (!mate || mate.tenant_id !== gate.tenantId || !STAFF_ROLES.includes(mate.role)) {
      return res.status(403).json({ error: 'Not a teammate in your casino' })
    }
    const [a, b] = [me, otherUserId].sort() // canonical order → one row per pair
    const existing = await db.from('internal_conversations').select('*')
      .eq('tenant_id', gate.tenantId).eq('kind', 'dm').eq('a_user_id', a).eq('b_user_id', b).maybeSingle()
    if (existing.data) return res.status(200).json({ conversation: existing.data })
    const { data, error } = await db.from('internal_conversations')
      .insert({ tenant_id: gate.tenantId, kind: 'dm', a_user_id: a, b_user_id: b }).select('*').single()
    if (error) return res.status(500).json({ error: 'Could not open thread' })
    return res.status(200).json({ conversation: data })
  }

  return res.status(400).json({ error: 'Unknown kind' })
}

async function setStar(req, res, db, me) {
  const { conversationId, is_starred } = req.body || {}
  if (!conversationId) return res.status(400).json({ error: 'conversationId required' })
  const { error } = await db.from('internal_reads')
    .upsert({ conversation_id: conversationId, user_id: me, is_starred: !!is_starred }, { onConflict: 'conversation_id,user_id' })
  if (error) return res.status(500).json({ error: 'Could not update' })
  return res.status(200).json({ ok: true })
}

async function loadProfiles(db, ids) {
  const map = {}
  if (!ids.length) return map
  const { data = [] } = await db.from('profiles').select('id, full_name, username, email, role').in('id', ids)
  for (const p of data) map[p.id] = p
  return map
}
async function loadTenants(db, ids) {
  const map = {}
  if (!ids.length) return map
  const { data = [] } = await db.from('tenants').select('id, name').in('id', ids)
  for (const t of data) map[t.id] = t.name
  return map
}
