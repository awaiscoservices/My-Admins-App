/**
 * POST /api/admin/payments/save
 * Creates a payment method when no id is given, updates it when there is one.
 *
 * Every field here is a real column on `payment_methods`. The form used to
 * send min_amount_cents, max_amount_cents, fee_percent, fee_fixed_cents and
 * processing_time — none of which exist — so a save wrote nothing useful and
 * an insert failed outright on the NOT NULL deposit limits.
 *
 * NOT NULL columns with defaults (min_deposit_cents, max_deposit_cents,
 * account_details, allow_deposit, allow_withdraw) must never be sent as null:
 * a default only applies when the column is left out, not when null is given.
 */
import { guardAdmin, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'

const TYPES = ['bank_transfer', 'crypto', 'card', 'ewallet', 'cash', 'other']

/** A number, or the fallback when the value is missing or not a number. */
function intOr(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PAYMENTS_WRITE })
  if (!gate) return
  const supabaseAdmin = gate.db
  const user = gate.actor

  const {
    id, name, type, icon, description, instructions, account_details,
    min_deposit_cents, max_deposit_cents, default_bonus_pct,
    is_active, is_auto, requires_proof, requires_reference, sort_order,
    allow_deposit, allow_withdraw,
  } = req.body

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

  const min = intOr(min_deposit_cents, 500)
  const max = intOr(max_deposit_cents, 100000)
  if (min < 0) return res.status(400).json({ error: 'Minimum deposit cannot be negative' })
  if (max < min) return res.status(400).json({ error: 'Maximum deposit must be at least the minimum' })

  const payload = {
    name:               name.trim(),
    type:               TYPES.includes(type) ? type : 'other',
    icon:               icon?.trim() || null,
    description:        description?.trim() || null,
    instructions:       instructions?.trim() || null,
    // jsonb and NOT NULL — an object or {}, never a string and never null.
    account_details:    account_details && typeof account_details === 'object' ? account_details : {},
    min_deposit_cents:  min,
    max_deposit_cents:  max,
    default_bonus_pct:  Number(default_bonus_pct) || 0,
    is_active:          is_active ?? true,
    is_auto:            is_auto ?? false,
    requires_proof:     requires_proof ?? true,
    requires_reference: requires_reference ?? true,
    allow_deposit:      allow_deposit ?? true,
    allow_withdraw:     allow_withdraw ?? true,
    sort_order:         intOr(sort_order, 0),
    updated_at:         new Date().toISOString(),
  }

  let result
  if (id) {
    // Load it first, scoped to the caller's casino, so another casino's
    // method is simply not found rather than quietly updated by id.
    const { row: existing } = await loadOwnedRow(gate, 'payment_methods', id, 'id, tenant_id')
    if (!existing) return res.status(404).json({ error: 'Payment method not found' })

    const { data, error } = await supabaseAdmin
      .from('payment_methods').update(payload).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    result = data
  } else {
    // tenant_id is NOT NULL, and a super admin has no casino of their own.
    if (!gate.tenantId) {
      return res.status(400).json({ error: 'Payment methods belong to a casino. Open the casino you want to add one to.' })
    }

    const { data, error } = await supabaseAdmin
      .from('payment_methods').insert({ ...payload, tenant_id: gate.tenantId }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    result = data
  }

  await supabaseAdmin.from('audit_logs').insert({
    tenant_id:   result.tenant_id,
    actor_id:    user.id,
    actor_role:  user.role,
    action:      id ? 'payment_method_updated' : 'payment_method_created',
    target_type: 'payment_method',
    target_id:   result.id,
    description: `${id ? 'Updated' : 'Added'} payment method "${result.name}"`,
  }).then(() => {}, () => {})

  return res.status(200).json({ success: true, row: result })
}
