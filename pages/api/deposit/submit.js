/**
 * POST /api/deposit/submit
 * Creates a deposit request. All validation server-side.
 * Never trusts client-side balance or bonus calculations.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Authenticate ──────────────────────────────────────────
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const {
    payment_method_id,
    amount_cents,
    player_reference,
    screenshot_url,
    player_notes,
    idempotency_key,
  } = req.body

  // ── Input validation ──────────────────────────────────────
  if (!payment_method_id) return res.status(400).json({ error: 'Payment method is required' })
  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0)
    return res.status(400).json({ error: 'Invalid amount' })
  if (!Number.isInteger(amount_cents))
    return res.status(400).json({ error: 'Amount must be in cents (integer)' })
  if (!screenshot_url && !player_reference)
    return res.status(400).json({ error: 'Please provide a transaction reference or screenshot' })
  if (!idempotency_key)
    return res.status(400).json({ error: 'Idempotency key is required' })

  // ── Check idempotency — prevent double submit ─────────────
  const { data: existing } = await supabaseAdmin
    .from('deposits')
    .select('id, reference_id, status')
    .eq('idempotency_key', idempotency_key)
    .single()

  if (existing) {
    return res.status(200).json({
      message: 'Deposit already submitted',
      deposit: existing,
      duplicate: true,
    })
  }

  // ── Load payment method & validate amount ─────────────────
  const { data: method, error: methodError } = await supabaseAdmin
    .from('payment_methods')
    .select('*')
    .eq('id', payment_method_id)
    .eq('is_active', true)
    .single()

  if (methodError || !method) return res.status(400).json({ error: 'Payment method not found or inactive' })

  // Check deposits are enabled for this method
  if (!method.allow_deposit)
    return res.status(400).json({ error: 'Deposits are not currently accepted via this payment method' })

  if (amount_cents < method.min_deposit_cents)
    return res.status(400).json({ error: `Minimum deposit is $${(method.min_deposit_cents / 100).toFixed(2)}` })
  if (amount_cents > method.max_deposit_cents)
    return res.status(400).json({ error: `Maximum deposit is $${(method.max_deposit_cents / 100).toFixed(2)}` })

  // ── Check player status ───────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('status, player_level_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'active')
    return res.status(403).json({ error: 'Account is not active' })

  // ── Calculate bonus SERVER-SIDE ───────────────────────────
  // Look up bonus from player_bonuses grid: payment_method × level × day_of_week
  // Falls back to 0% if no rule configured. Never trust client-sent amounts.
  const dayOfWeek = new Date().getDay() // 0=Sun
  const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek // 1=Mon…7=Sun

  let bonus_pct = 0
  const { data: bonusRule } = await supabaseAdmin
    .from('player_bonuses')
    .select('bonus_percent')
    .eq('payment_method_id', payment_method_id)
    .eq('player_level_id', profile.player_level_id)
    .eq('day_number', dayNumber)
    .eq('is_active', true)
    .maybeSingle()

  if (bonusRule?.bonus_percent) bonus_pct = parseFloat(bonusRule.bonus_percent)

  const bonus_cents = Math.floor(amount_cents * (bonus_pct / 100))
  const total_credit_cents = amount_cents + bonus_cents

  // ── Create deposit record ─────────────────────────────────
  const { data: deposit, error: depositError } = await supabaseAdmin
    .from('deposits')
    .insert({
      user_id: user.id,
      payment_method_id,
      amount_cents,
      bonus_cents,
      bonus_pct_applied: bonus_pct,
      total_credit_cents,
      player_reference: player_reference || null,
      screenshot_url: screenshot_url || null,
      player_notes: player_notes || null,
      status: 'pending',
      idempotency_key,
    })
    .select()
    .single()

  if (depositError) {
    console.error('Deposit insert error:', depositError)
    return res.status(500).json({ error: 'Failed to create deposit request' })
  }

  // ── Update pending_cents in wallet ────────────────────────
  await supabaseAdmin.rpc('increment_wallet_pending', {
    p_user_id: user.id,
    p_cents: total_credit_cents,
  }).then(() => {}, () => {}) // non-fatal if RPC not yet created

  // ── Create notification ───────────────────────────────────
  await supabaseAdmin.from('notifications').insert({
    user_id: user.id,
    type: 'general',
    title: 'Deposit Submitted',
    message: `Your deposit of $${(amount_cents / 100).toFixed(2)} (${deposit.reference_id}) has been submitted and is pending review.`,
    reference_id: deposit.reference_id,
  }).then(() => {}, () => {})

  return res.status(201).json({
    message: 'Deposit submitted successfully',
    deposit: {
      id: deposit.id,
      reference_id: deposit.reference_id,
      amount_cents,
      bonus_cents,
      total_credit_cents,
      status: 'pending',
    },
  })
}
