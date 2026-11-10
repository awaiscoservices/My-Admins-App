/**
 * GET /api/admin/support/ticket?id=
 * POST /api/admin/support/ticket — reply or close ticket
 */
import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  const gate = await guardAdmin(req, res, { allow: PERMS.SUPPORT_READ })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor
  const staff = gate.actor

  if (req.method === 'GET') {
    const { id } = req.query
    const [ticket, messages] = await Promise.all([
      scopeToTenant(supabaseAdmin.from('support_tickets').select('*, profiles!support_tickets_user_id_fkey(full_name, email)').eq('id', id), gate).maybeSingle(),
      supabaseAdmin.from('support_messages').select('*, profiles!support_messages_sender_id_fkey(full_name, role)').eq('ticket_id', id).order('created_at'),
    ])
    return res.status(200).json({ ticket: ticket.data, messages: messages.data || [] })
  }

  if (req.method === 'POST') {
    const { ticket_id, action, message } = req.body

    if (action === 'reply') {
      if (!message?.trim()) return res.status(400).json({ error: 'Message required' })
      // Another casino's ticket must not be replyable.
      const { row: owned } = await loadOwnedRow(gate, 'support_tickets', ticket_id, 'id')
      if (!owned) return res.status(404).json({ error: 'Ticket not found' })

      await supabaseAdmin.from('support_messages').insert({ tenant_id: gate.tenantId, ticket_id, sender_id: user.id, message: message.trim(), is_staff: true })
      await supabaseAdmin.from('support_tickets').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', ticket_id)
      await supabaseAdmin.from('support_tickets').select('user_id').eq('id', ticket_id).single().then(({ data }) => {
        if (data) supabaseAdmin.from('notifications').insert({ user_id: data.user_id, type: 'support_reply', title: 'Support Reply', message: `Staff replied to your ticket.` }).then(() => {}, () => {})
      })
    } else if (action === 'close') {
      await supabaseAdmin.from('support_tickets').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', ticket_id)
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }
    return res.status(200).json({ message: 'Done' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
