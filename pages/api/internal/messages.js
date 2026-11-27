/**
 * /api/internal/messages — messages inside one internal Support thread.
 *
 * GET  ?conversationId=…  → { messages }  and marks the thread read for me.
 * POST { conversationId, body?, file }     → inserts my message.
 *
 * Access rule (same shape as the inbox): a super admin may use any platform
 * thread; a tenant staff member may use their own casino's platform thread and
 * any DM they are part of.
 */
import { guardAdmin, PERMS } from '../../../lib/adminGuard'

function staffLabel(p) { return p?.full_name || p?.username || p?.email || 'Staff' }

async function loadConversation(gate, id) {
  const { data } = await gate.db.from('internal_conversations').select('*').eq('id', id).maybeSingle()
  return data || null
}

function canAccess(gate, conv) {
  if (!conv) return false
  if (gate.isSuperAdmin) return conv.kind === 'platform'
  if (conv.tenant_id !== gate.tenantId) return false
  if (conv.kind === 'platform') return true
  return conv.a_user_id === gate.actor.id || conv.b_user_id === gate.actor.id
}

export default async function handler(req, res) {
  const gate = await guardAdmin(req, res, { allow: PERMS.INTERNAL_CHAT })
  if (!gate) return
  const { db, actor } = gate
  const me = actor.id

  if (req.method === 'GET') {
    const conv = await loadConversation(gate, req.query.conversationId)
    if (!canAccess(gate, conv)) return res.status(403).json({ error: 'Forbidden' })

    const { data: messages = [] } = await db.from('internal_messages')
      .select('id, conversation_id, sender_id, body, file_url, file_name, file_type, created_at')
      .eq('conversation_id', conv.id).order('created_at', { ascending: true })

    // Name the senders (platform threads mix many people on one side).
    const ids = [...new Set(messages.map(m => m.sender_id))]
    const nameMap = {}
    if (ids.length) {
      const { data: profs = [] } = await db.from('profiles').select('id, full_name, username, email, role').in('id', ids)
      for (const p of profs) nameMap[p.id] = { name: staffLabel(p), role: p.role }
    }
    const out = messages.map(m => ({ ...m, sender_name: nameMap[m.sender_id]?.name || 'Staff', sender_role: nameMap[m.sender_id]?.role || null, mine: m.sender_id === me }))

    // Mark read.
    await db.from('internal_reads').upsert(
      { conversation_id: conv.id, user_id: me, last_read_at: new Date().toISOString() },
      { onConflict: 'conversation_id,user_id' },
    )

    return res.status(200).json({ messages: out, me })
  }

  if (req.method === 'POST') {
    const { conversationId, body, file } = req.body || {}
    const conv = await loadConversation(gate, conversationId)
    if (!canAccess(gate, conv)) return res.status(403).json({ error: 'Forbidden' })
    if (!body?.trim() && !file?.url) return res.status(400).json({ error: 'Empty message' })

    const { data, error } = await db.from('internal_messages').insert({
      conversation_id: conv.id,
      tenant_id: conv.tenant_id,
      sender_id: me,
      body: body?.trim() || null,
      file_url: file?.url || null,
      file_name: file?.name || null,
      file_type: file?.type || null,
    }).select('*').single()
    if (error) return res.status(500).json({ error: 'Could not send' })

    const now = new Date().toISOString()
    await db.from('internal_conversations').update({ last_message_at: now, updated_at: now }).eq('id', conv.id)
    await db.from('internal_reads').upsert(
      { conversation_id: conv.id, user_id: me, last_read_at: now },
      { onConflict: 'conversation_id,user_id' },
    )

    return res.status(200).json({ message: { ...data, mine: true } })
  }

  return res.status(405).end()
}
