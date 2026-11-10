import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.ADJUSTMENTS_CREATE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const admin = gate.actor

  const { user_id, type, amount_cents, reason } = req.body
  if (!user_id || !['credit', 'debit'].includes(type) || !amount_cents || amount_cents <= 0 || !reason?.trim()) {
    return res.status(400).json({ error: 'Invalid params' })
  }

  const { data: wallet, error: wErr } = await scopeToTenant(supabaseAdmin.from('wallets').select('*').eq('user_id', user_id), gate).maybeSingle()
  if (wErr || !wallet) return res.status(404).json({ error: 'Wallet not found' })

  if (type === 'debit' && wallet.cash_balance_cents < amount_cents) {
    return res.status(400).json({ error: 'Insufficient balance for debit' })
  }

  const newBalance = type === 'credit'
    ? wallet.cash_balance_cents + amount_cents
    : wallet.cash_balance_cents - amount_cents

  const { error: updateErr } = await supabaseAdmin.from('wallets')
    .update({ cash_balance_cents: newBalance, version: wallet.version + 1, updated_at: new Date().toISOString() })
    .eq('user_id', user_id)
    .eq('version', wallet.version)
  if (updateErr) return res.status(409).json({ error: 'Concurrent update, please retry' })

  const refId = `ADJ-${Date.now()}`

  await supabaseAdmin.from('wallet_adjustments').insert({
    tenant_id: gate.tenantId,
    user_id, type, amount_cents, reason: reason.trim(),
    reference_id: refId, performed_by: admin.id, created_at: new Date().toISOString()
  })

  await supabaseAdmin.from('ledger').insert({
    tenant_id: gate.tenantId,
    user_id, type: 'adjustment', amount_cents,
    reference_id: refId, description: reason.trim(), created_at: new Date().toISOString()
  })

  await supabaseAdmin.from('audit_logs').insert({
    action: `adjustment_${type}`, performed_by: admin.id,
    target_type: 'player', target_id: user_id,
    details: { amount_cents, reason, ref_id: refId },
  })

  return res.status(200).json({ success: true, reference_id: refId })
}
