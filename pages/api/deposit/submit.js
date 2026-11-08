/**
 * POST /api/deposit/submit
 *
 * Changes from v1:
 *  1. Checks allow_deposit = true on payment method
 *  2. Looks up bonus from player_bonuses grid (payment_method × level × day_of_week)
 *     instead of method.default_bonus_pct
 *  3. Referral bonus credited to referrer on depositor's 1st/2nd/3rd deposit
 *     (via referral_bonus_tiers table)
 *
 * Security rules maintained:
 *  - SUPABASE_SERVICE_ROLE_KEY server-side only
 *  - All amounts integer cents, all calculations server-side
 *  - Ledger is append-only
 *  - Idempotency key prevents double-submit
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

// Day-of-week → 1 (Mon) … 7 (Sun) matching player_bonuses.day_number
function todayDayNumber() {
  const d = new Date().getDay() // 0=Sun
  return d === 0 ? 7 : d
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Authenticate ──────────────────────────────────────────────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

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

  // ── Input validation ──────────────────────────────────────────────────────
  if (!payment_method_id)
    return res.status(400).json({ error: 'Payment method is required' })
  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents <= 0 || !Number.isInteger(amount_cents))
    return res.status(400).json({ error: 'Invalid amount (must be positive integer cents)' })
  if (!screenshot_url && !player_reference)
    return res.status(400).json({ error: 'Please provide a transaction reference or screenshot' })
  if (!idempotency_key)
    return res.status(400).json({ error: 'Idempotency key is required' })

  // ── Idempotency ───────────────────────────────────────────────────────────
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

  // ── Load payment method ───────────────────────────────────────────────────
  const { data: method, error: methodError } = await supabaseAdmin
    .from('payment_methods')
    .select('id, name, is_active, allow_deposit, min_deposit_cents, max_deposit_cents')
    .eq('id', payment_method_id)
    .single()

  if (methodError || !method)
    return res.status(400).json({ error: 'Payment method not found' })
  if (!method.is_active)
    return res.status(400).json({ error: 'Payment method is not active' })

  // ── Task 37: allow_deposit check ──────────────────────────────────────────
  if (!method.allow_deposit)
    return res.status(400).json({ error: 'Deposits are not currently accepted via this payment method' })

  if (amount_cents < method.min_deposit_cents)
    return res.status(400).json({ error: `Minimum deposit is $${(method.min_deposit_cents / 100).toFixed(2)}` })
  if (amount_cents > method.max_deposit_cents)
    return res.status(400).json({ error: `Maximum deposit is $${(method.max_deposit_cents / 100).toFixed(2)}` })

  // ── Load player profile ───────────────────────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('status, player_level_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'active')
    return res.status(403).json({ error: 'Account is not active' })

  // ── Task 39: Look up bonus from player_bonuses grid ───────────────────────
  // Grid: payment_method × player_level × day_of_week
  // Falls back to 0% if no rule found
  const dayNumber = todayDayNumber()
  let bonus_pct = 0

  const { data: bonusRule } = await supabaseAdmin
    .from('player_bonuses')
    .select('bonus_percent')
    .eq('payment_method_id', payment_method_id)
    .eq('player_level_id', profile.player_level_id)
    .eq('day_number', dayNumber)
    .eq('is_active', true)
    .single()

  if (bonusRule?.bonus_percent) {
    bonus_pct = parseFloat(bonusRule.bonus_percent)
  }

  // All financial calculations server-side, integer cents
  const bonus_cents = Math.floor(amount_cents * (bonus_pct / 100))
  const total_credit_cents = amount_cents + bonus_cents

  // ── Create deposit record ─────────────────────────────────────────────────
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
    console.error('[deposit/submit] insert error:', depositError)
    return res.status(500).json({ error: 'Failed to create deposit request' })
  }

  // ── Task 41: Referral bonus to referrer (best-effort, non-fatal) ──────────
  // Runs async — deposit is already created; referral credit failure must not
  // block the player's deposit response.
  creditReferralBonus(user.id, deposit.id, amount_cents).catch(err =>
    console.error('[deposit/submit] referral bonus error:', err)
  )

  // ── Pending wallet update (best-effort) ───────────────────────────────────
  await supabaseAdmin.rpc('increment_wallet_pending', {
    p_user_id: user.id,
    p_cents: total_credit_cents,
  }).then(() => {}, () => {})

  // ── Notification ──────────────────────────────────────────────────────────
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
      bonus_pct_applied: bonus_pct,
      total_credit_cents,
      status: 'pending',
    },
  })
}

/**
 * Task 41 — Referral bonus logic
 *
 * After a deposit is confirmed PENDING (not yet approved), we update the
 * referral record timestamps. The actual cash credit to the referrer happens
 * when an admin APPROVES the deposit (in the deposit-approve API), because
 * the deposit might be rejected.
 *
 * Here we just track: how many confirmed deposits has this referee made?
 * We update referrals.first_deposit_at / first_deposit_cents on the first one.
 */
async function creditReferralBonus(userId, depositId, amountCents) {
  // Find if this user was referred
  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('id, referrer_id, first_deposit_at, reward_status')
    .eq('referred_id', userId)
    .eq('reward_status', 'pending')
    .single()

  if (!referral) return // not referred, nothing to do

  // Count how many deposits this user has previously made (excluding this one)
  const { count: prevDepositCount } = await supabaseAdmin
    .from('deposits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'approved')

  const depositNumber = (prevDepositCount || 0) + 1 // 1st, 2nd, 3rd pending deposit

  // Record first deposit timestamp on the referral row
  if (depositNumber === 1 && !referral.first_deposit_at) {
    await supabaseAdmin
      .from('referrals')
      .update({
        first_deposit_at: new Date().toISOString(),
        first_deposit_cents: amountCents,
      })
      .eq('id', referral.id)
  }

  // Look up referral bonus tier for this deposit number (1, 2, or 3)
  const { data: tier } = await supabaseAdmin
    .from('referral_bonus_tiers')
    .select('bonus_percent')
    .eq('deposit_number', depositNumber)
    .eq('is_active', true)
    .single()

  if (!tier) return // no tier configured for this deposit number

  // Calculate referral bonus in cents (% of the referee's deposit)
  const referralBonusCents = Math.floor(amountCents * (parseFloat(tier.bonus_percent) / 100))
  if (referralBonusCents <= 0) return

  // Log to audit so admin can review before payout
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:  userId, // the referee triggered this
    action:    'referral.deposit_bonus_queued',
    entity:    'referrals',
    entity_id: referral.id,
    metadata:  {
      referrer_id:          referral.referrer_id,
      deposit_id:           depositId,
      deposit_number:       depositNumber,
      deposit_cents:        amountCents,
      bonus_percent:        tier.bonus_percent,
      referral_bonus_cents: referralBonusCents,
      note:                 'Pending deposit approval before payout',
    },
  })
}
