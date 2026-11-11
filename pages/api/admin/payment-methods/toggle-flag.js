/**
 * pages/api/admin/payment-methods/toggle-flag.js
 *
 * POST { id, flag: 'allow_deposit'|'allow_withdraw', value: boolean }
 * → updates payment_methods SET <flag> = value WHERE id = id
 *
 * Admin-only. Uses service-role key (server-side only).
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../../lib/adminGuard'

const ALLOWED_FLAGS = ['allow_deposit', 'allow_withdraw']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PAYMENTS_WRITE })
  if (!gate) return
  const admin = gate.db

  // ── Validate body ─────────────────────────────────────────────────────────
  const { id, flag, value } = req.body

  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' })
  if (!ALLOWED_FLAGS.includes(flag))  return res.status(400).json({ error: `flag must be one of: ${ALLOWED_FLAGS.join(', ')}` })
  if (typeof value !== 'boolean')     return res.status(400).json({ error: 'value must be boolean' })

  // ── Apply update ──────────────────────────────────────────────────────────
  // Scoped: another casino's payment method must not be togglable.
  const { data, error } = await scopeToTenant(
    admin
      .from('payment_methods')
      .update({ [flag]: value, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, allow_deposit, allow_withdraw'),
    gate,
  ).maybeSingle()

  if (error) {
    console.error('[toggle-flag]', error)
    return res.status(500).json({ error: error.message })
  }

  // ── Audit log (best-effort) ───────────────────────────────────────────────
  await admin.from('audit_logs').insert({
    tenant_id:  gate.tenantId,
    actor_id:   gate.actor.id,
    action:     'payment_method.flag_changed',
    entity:     'payment_methods',
    entity_id:  id,
    metadata:   { flag, old_value: !value, new_value: value },
  }).then(() => {}) // ignore error — don't fail the request if audit table is missing

  if (!data) return res.status(404).json({ error: 'Payment method not found' })

  return res.status(200).json({ ok: true, method: data })
}
