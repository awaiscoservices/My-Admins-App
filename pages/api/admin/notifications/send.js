import { createPagesServerClient } from '../../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const svc = createPagesServerClient({ req, res }, { supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  const { data: staff } = await svc.from('staff_profiles').select('role').eq('user_id', session.user.id).single();
  if (!staff || !['super_admin','marketing'].includes(staff.role)) return res.status(403).json({ error: 'Forbidden' });

  const { title, message, target, min_level, send_at } = req.body;
  if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'title and message required' });

  // Log the broadcast record
  const { data: broadcast, error: bcErr } = await svc.from('broadcast_notifications').insert({
    title: title.trim(), message: message.trim(), target, min_level: min_level||1,
    send_at: send_at || null, sent_by: session.user.id,
    sent_count: send_at ? null : 0, // will update after send
    created_at: new Date().toISOString(),
  }).select('id').single();

  if (bcErr) return res.status(500).json({ error: bcErr.message });

  // If send_at is in the future, just schedule — don't fan-out now
  if (send_at && new Date(send_at) > new Date()) {
    return res.status(200).json({ success: true, scheduled: true });
  }

  // Fan-out: get matching players
  let query = svc.from('wallets').select('player_id, level');
  if (target === 'vip') query = query.gte('level', 5);
  else if (target === 'level_plus') query = query.gte('level', min_level||1);

  const { data: targets } = await query;
  if (!targets?.length) {
    await svc.from('broadcast_notifications').update({ sent_count: 0 }).eq('id', broadcast.id);
    return res.status(200).json({ success: true, sent_count: 0 });
  }

  const notifs = targets.map(t => ({ player_id: t.player_id, type: 'broadcast', title: title.trim(), message: message.trim(), read: false }));
  // Insert in chunks of 500
  const CHUNK = 500;
  for (let i = 0; i < notifs.length; i += CHUNK) {
    await svc.from('notifications').insert(notifs.slice(i, i + CHUNK));
  }

  await svc.from('broadcast_notifications').update({ sent_count: targets.length }).eq('id', broadcast.id);
  await svc.from('audit_logs').insert({ action: 'notification_broadcast', performed_by: session.user.id, target_type: 'broadcast', target_id: broadcast.id, details: { title, target, sent_count: targets.length } });

  return res.status(200).json({ success: true, sent_count: targets.length });
}
