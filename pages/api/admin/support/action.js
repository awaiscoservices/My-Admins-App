import { createPagesServerClient } from '../../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const svc = createPagesServerClient({ req, res }, {
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const { data: staff } = await svc.from('staff_profiles').select('role').eq('user_id', session.user.id).single();
  if (!staff || !['super_admin','support'].includes(staff.role)) return res.status(403).json({ error: 'Forbidden' });

  const { ticket_id, message, close } = req.body;
  if (!ticket_id || !message?.trim()) return res.status(400).json({ error: 'ticket_id and message required' });

  const { data: ticket } = await svc.from('support_tickets').select('*').eq('id', ticket_id).single();
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  await svc.from('support_messages').insert({ ticket_id, sender_type: 'staff', sender_id: session.user.id, body: message.trim() });

  if (close) {
    await svc.from('support_tickets').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', ticket_id);
    await svc.from('notifications').insert({ player_id: ticket.player_id, type: 'support', title: 'Support ticket closed', message: 'Your support ticket has been resolved.', read: false });
  }

  await svc.from('audit_logs').insert({ action: close ? 'support_reply_close' : 'support_reply', performed_by: session.user.id, target_type: 'support_ticket', target_id: ticket_id, details: { closed: !!close } });

  return res.status(200).json({ success: true });
}
