/**
 * GET  /api/admin/chat/messages?conversationId=<uuid>
 *   Load all messages for a conversation. Marks unread player messages as read.
 *   Roles: super_admin, admin, support
 *
 * POST /api/admin/chat/messages
 *   Body: { conversationId, body }
 *   Send a staff reply. Stamps tenant_id from parent conversation.
 *   Roles: super_admin, admin, support
 *
 * Scoped by:
 *   - GET: loadOwnedRow() verifies conversation belongs to caller's tenant (404 if not)
 *   - POST: same check before insert; tenant_id copied from conversation row
 * NOT scoped: nothing — no cross-tenant data can escape.
 */
import { guardAdmin, loadOwnedRow, tenantOf, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method === 'GET') return getMessages(req, res)
  if (req.method === 'POST') return sendMessage(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function getMessages(req, res) {
  const gate = await guardAdmin(req, res, { allow: PERMS.CHAT_READ })
  if (!gate) return

  const { conversationId } = req.query
  if (!conversationId) return res.status(400).json({ error: 'conversationId required' })

  // Ownership check — returns 404 if conversation belongs to another tenant
  const { row: conv, error: ownerErr } = await loadOwnedRow(
    gate, 'chat_conversations', conversationId, 'id, tenant_id, user_id, status'
  )
  if (ownerErr || !conv) return res.status(404).json({ error: 'Conversation not found' })

  const { data: messages, error } = await gate.db
    .from('chat_messages')
    .select('id, sender_id, sender_type, body, read_at, created_at')
    .eq('conversation_id', conversationId)
    .eq('tenant_id', conv.tenant_id)   // belt + suspenders
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  // Mark unread player messages as read (fire-and-forget, non-blocking)
  const unreadIds = (messages ?? [])
    .filter(m => m.sender_type === 'player' && !m.read_at)
    .map(m => m.id)

  if (unreadIds.length) {
    gate.db
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
      .eq('tenant_id', conv.tenant_id)
      .then(() => {})
  }

  return res.json({ messages: messages ?? [] })
}

async function sendMessage(req, res) {
  const gate = await guardAdmin(req, res, { allow: PERMS.CHAT_SEND })
  if (!gate) return

  const { conversationId, body } = req.body ?? {}
  if (!conversationId || !body?.trim()) {
    return res.status(400).json({ error: 'conversationId and body required' })
  }
  if (body.trim().length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 chars)' })
  }

  // Ownership check — 404 if conversation belongs to another tenant
  const { row: conv, error: ownerErr } = await loadOwnedRow(
    gate, 'chat_conversations', conversationId, 'id, tenant_id, status'
  )
  if (ownerErr || !conv) return res.status(404).json({ error: 'Conversation not found' })
  if (conv.status === 'closed') return res.status(409).json({ error: 'Conversation is closed' })

  const now = new Date().toISOString()

  const { data: message, error } = await gate.db
    .from('chat_messages')
    .insert({
      tenant_id:       conv.tenant_id,   // inherited from parent — not from request
      conversation_id: conversationId,
      sender_id:       gate.actor.id,
      sender_type:     'staff',
      body:            body.trim(),
    })
    .select('id, sender_id, sender_type, body, read_at, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Update last_message_at on the conversation
  await gate.db
    .from('chat_conversations')
    .update({ last_message_at: now, updated_at: now })
    .eq('id', conversationId)
    .eq('tenant_id', conv.tenant_id)

  return res.status(201).json({ message })
}
