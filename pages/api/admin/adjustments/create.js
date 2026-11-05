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
  if (!staff || !['super_admin','finance'].includes(staff.role)) return res.status(403).json({ error: 'Forbidden' });

  const { player_id, type, amount_cents, reason } = req.body;
  if (!player_id || !['credit','debit'].includes(type) || !amount_cents || amount_cents <= 0 || !reason?.trim()) {
    return res.status(400).json({ error: 'Invalid params' });
  }

  // Get wallet with optimistic lock
  const { data: wallet, error: wErr } = await svc.from('wallets').select('*').eq('player_id', player_id).single();
  if (wErr || !wallet) return res.status(404).json({ error: 'Wallet not found' });

  if (type === 'debit' && wallet.cash_balance_cents < amount_cents) {
    return res.status(400).json({ error: 'Insufficient balance for debit' });
  }

  const newBalance = type === 'credit'
    ? wallet.cash_balance_cents + amount_cents
    : wallet.cash_balance_cents - amount_cents;

  const { error: updateErr } = await svc.from('wallets')
    .update({ cash_balance_cents: newBalance, version: wallet.version + 1, updated_at: new Date().toISOString() })
    .eq('player_id', player_id)
    .eq('version', wallet.version);

  if (updateErr) return res.status(409).json({ error: 'Concurrent update, please retry' });

  // Sequence for ref_id
  const { data: seqData } = await svc.rpc('nextval', { seq_name: 'seq_adjustment' }).single().catch(() => ({ data: null }));
  const refId = seqData ? `ADJ-${String(seqData).padStart(6,'0')}` : `ADJ-${Date.now()}`;

  await svc.from('ledger_entries').insert({
    player_id, ref_id: refId, type: 'adjustment',
    direction: type, amount_cents, description: reason,
  });

  await svc.from('audit_logs').insert({
    action: `adjustment_${type}`, performed_by: session.user.id,
    target_type: 'player', target_id: player_id,
    details: { amount_cents, reason, ref_id: refId },
  });

  return res.status(200).json({ success: true, ref_id: refId });
}
