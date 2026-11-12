/**
 * GET  /api/admin/chat/conversations
 *   List all open conversations for the caller's casino.
 *   Super admins see all tenants (scopeToTenant passes through for them).
 *   Roles: super_admin, admin, support
 *
 * Scoped by: scopeToTenant() on chat_conversations, keyed to tenant_id.
 * NOT scoped: nothing — all reads go through gate.
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'
import { maskPlayer } from '../../../../lib/playerLabel'

export default async function handler(req, res) {
  if (req.method === 'PATCH') return setStatus(req, res)
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.CHAT_READ })
  if (!gate) return

  const { status = 'open' } = req.query
  if (!['open', 'closed', 'all'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status filter' })
  }

  // 1. Load conversations scoped to this tenant
  let q = gate.db
    .from('chat_conversations')
    .select('id, tenant_id, user_id, status, last_message_at, created_at')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  q = scopeToTenant(q, gate)

  if (status !== 'all') q = q.eq('status', status)

  const { data: convs, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  if (!convs?.length) return res.json({ conversations: [] })

  // 2. Load player names via service-role (profiles RLS not verified)
  //    Only for user_ids that belong to this tenant's conversations.
  const userIds = [...new Set(convs.map(c => c.user_id))]

  const { data: profiles, error: pErr } = await gate.db
    .from('profiles')
    .select('id, username, tenant_id')
    .in('id', userIds)
    .eq('tenant_id', gate.tenantId ?? convs[0].tenant_id)

  if (pErr) return res.status(500).json({ error: pErr.message })

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // 3. Attach unread count (messages without read_at, sent by player)
  const convIds = convs.map(c => c.id)
  const { data: unreadRows } = await gate.db
    .from('chat_messages')
    .select('conversation_id')
    .in('conversation_id', convIds)
    .eq('sender_type', 'player')
    .is('read_at', null)

  const unreadMap = {}
  for (const row of unreadRows ?? []) {
    unreadMap[row.conversation_id] = (unreadMap[row.conversation_id] ?? 0) + 1
  }

  const result = convs.map(c => ({
    ...c,
    player: maskPlayer(profileMap[c.user_id]) ?? { username: 'Player', full_name: 'Player', email: null },
    unread: unreadMap[c.id] ?? 0,
  }))

  return res.json({ conversations: result })
}

/**
 * PATCH /api/admin/chat/conversations  { conversationId, status }
 *   Close or reopen a conversation. Scoped to the caller's tenant.
 *   Roles: super_admin, admin, support
 */
async function setStatus(req, res) {
  const gate = await guardAdmin(req, res, { allow: PERMS.CHAT_SEND })
  if (!gate) return

  const { conversationId, status } = req.body ?? {}
  if (!conversationId) return res.status(400).json({ error: 'conversationId required' })
  if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be open or closed' })

  // Ownership check — 404 if the conversation belongs to another tenant
  const { row: conv, error: ownerErr } = await loadOwnedRow(
    gate, 'chat_conversations', conversationId, 'id, tenant_id'
  )
  if (ownerErr || !conv) return res.status(404).json({ error: 'Conversation not found' })

  const now = new Date().toISOString()
  const { error } = await gate.db
    .from('chat_conversations')
    .update({ status, updated_at: now })
    .eq('id', conversationId)
    .eq('tenant_id', conv.tenant_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true, status })
}
