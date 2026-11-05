import { createPagesServerClient } from '../../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const svc = createPagesServerClient({ req, res }, { supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  const { data: staff } = await svc.from('staff_profiles').select('role').eq('user_id', session.user.id).single();
  if (!staff || !['super_admin','marketing'].includes(staff.role)) return res.status(403).json({ error: 'Forbidden' });
  const { promo_id, name, type, bonus_amount_cents, min_deposit_cents, start_date, end_date, active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const payload = { name: name.trim(), type, bonus_amount_cents: bonus_amount_cents||null, min_deposit_cents: min_deposit_cents||null, start_date: start_date||null, end_date: end_date||null, active: !!active, updated_at: new Date().toISOString() };
  if (promo_id) {
    const { error } = await svc.from('promotions').update(payload).eq('id', promo_id);
    if (error) return res.status(500).json({ error: error.message });
  } else {
    const { error } = await svc.from('promotions').insert({ ...payload, created_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
  }
  await svc.from('audit_logs').insert({ action: promo_id?'promo_update':'promo_create', performed_by: session.user.id, target_type: 'promotion', target_id: promo_id||null, details: { name } });
  return res.status(200).json({ success: true });
}
