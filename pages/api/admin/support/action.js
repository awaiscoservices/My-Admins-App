import { guardAdmin, scopeToTenant, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.SUPPORT_ACTION })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { ticket_id, message, close } = req.body
  if (!ticket_id || !message?.trim()) return res.status(400).json({ error: 'ticket_id and message required' })

  // Scoped: another casino's ticket is not found, so it cannot be replied to.
  const { row: ticket } = await loadOwnedRow(gate, 'support_tickets', ticket_id)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  await supabaseAdmin.from('support_messages').insert({
    ticket_id, sender_type: 'staff', sender_id: admin.id, body: message.trim()
  })

  if (close) {
    await supabaseAdmin.from('support_tickets').update({
      status: 'closed', closed_at: new Date().toISOString(),
      admin_reply: message.trim(), replied_by: admin.id, replied_at: new Date().toISOString()
    }).eq('id', ticket_id)
    await supabaseAdmin.from('notifications').insert({
      user_id: ticket.user_id, type: 'support_reply',
      title: 'Support replied 💬', message: `Re: ${ticket.subject} — ${message.trim()}`,
      read: false, created_at: new Date().toISOString()
    })
  }

  await supabaseAdmin.from('audit_logs').insert({
    action: close ? 'support_reply_close' : 'support_reply',
    performed_by: admin.id, target_type: 'support_ticket', target_id: ticket_id,
    details: { closed: !!close }
  })

  return res.status(200).json({ success: true })
}
