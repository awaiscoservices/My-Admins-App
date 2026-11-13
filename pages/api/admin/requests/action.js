/**
 * POST /api/admin/requests/action
 * body: { kind, id, action, reason?, amount_cents?, reference? }
 * Processes one request from an admin queue. Money moves only inside database
 * functions (see supabase/admin-setup.sql), which lock the wallet so it is atomic.
 */
import { supabaseAdmin, requireStaff, QUEUES, notify, audit, safe, usd } from '../../../../lib/adminApi'

const ACTIONS = {
  game_loads:  ['completed', 'rejected', 'under_review'],
  redemptions: ['completed', 'rejected', 'under_review'],
  withdrawals: ['completed', 'rejected', 'under_review'],
  kyc:         ['verified', 'rejected', 'more_info_required'],
  support:     ['in_progress', 'resolved', 'closed'],
}
const RPC = { game_loads: 'process_game_load', redemptions: 'process_redemption', withdrawals: 'process_withdrawal' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { kind, id, action, reason, amount_cents, reference } = req.body || {}
  const cfg = QUEUES[kind]
  if (!cfg) return res.status(400).json({ error: 'Unknown queue' })

  const admin = await requireStaff(req, res, cfg.roles)
  if (!admin) return

  if (!id || !action) return res.status(400).json({ error: 'id and action are required' })
  if (!ACTIONS[kind].includes(action)) return res.status(400).json({ error: 'Invalid action' })
  const text = (reason || '').trim()
  if (['rejected', 'more_info_required'].includes(action) && !text)
    return res.status(400).json({ error: 'A reason is required' })
  if (kind === 'support' && action === 'resolved' && !text)
    return res.status(400).json({ error: 'Write a reply before resolving' })

  // ── Money queues: one atomic database call ──────────────────
  if (RPC[kind]) {
    const args = { p_id: id, p_action: action, p_reason: text || null, p_admin: admin.id }
    if (kind === 'redemptions') {
      if (amount_cents != null && (!Number.isInteger(amount_cents) || amount_cents <= 0))
        return res.status(400).json({ error: 'Invalid amount' })
      args.p_amount = amount_cents ?? null
    }
    if (kind === 'withdrawals') args.p_reference = (reference || '').trim() || null

    const { data, error } = await supabaseAdmin.rpc(RPC[kind], args)
    if (error) return res.status(400).json({ error: error.message })

    const amt = usd(data.amount_cents)
    const MSG = {
      game_loads:  { completed: ['Game Load Completed 🎮', `Your game load of ${amt} is complete. Good luck!`],
                     rejected:  ['Game Load Rejected', `Your game load of ${amt} was rejected and the money is back in your wallet. Reason: ${text}`] },
      redemptions: { completed: ['Redeem Approved 🏆', `Your redeem of ${amt} was approved and added to your wallet.`],
                     rejected:  ['Redeem Rejected', `Your redeem request of ${amt} was rejected. Reason: ${text}`] },
      withdrawals: { completed: ['Withdraw Sent 💸', `Your withdraw of ${amt} has been paid out.${args.p_reference ? ` Reference: ${args.p_reference}` : ''}`],
                     rejected:  ['Withdraw Rejected', `Your withdraw of ${amt} was rejected and the money is back in your wallet. Reason: ${text}`] },
    }
    const m = MSG[kind][action]
    if (m) await notify(data.user_id, `${kind}_${action}`, m[0], m[1])
    await audit(admin, `${kind}_${action}`, kind, id, null, { status: action, amount_cents: data.amount_cents }, text)
    return res.status(200).json({ message: `Request ${action.replace('_', ' ')}`, result: data })
  }

  // ── KYC ─────────────────────────────────────────────────────
  if (kind === 'kyc') {
    const { data: rec } = await admin.scope(supabaseAdmin.from('kyc_records').select('*').eq('id', id)).maybeSingle()
    if (!rec) return res.status(404).json({ error: 'Record not found' })
    if (!['pending', 'under_review'].includes(rec.status))
      return res.status(409).json({ error: `Already ${rec.status}` })

    const { error } = await supabaseAdmin.from('kyc_records').update({
      status: action, rejection_reason: text || null, reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    await safe(supabaseAdmin.from('profiles').update({ kyc_status: action }).eq('id', rec.user_id))

    const MSG = {
      verified:           ['Identity Verified ✅', 'Your identity is verified. Withdraws are now unlocked.'],
      rejected:           ['Verification Rejected', `We could not verify your identity. Reason: ${text}. You can submit again.`],
      more_info_required: ['More Information Needed', `We need more information to verify you: ${text}. Please submit again.`],
    }[action]
    await notify(rec.user_id, `kyc_${action}`, MSG[0], MSG[1])
    await audit(admin, `kyc_${action}`, 'kyc', id, { status: rec.status }, { status: action }, text)
    return res.status(200).json({ message: `Verification ${action.replace(/_/g, ' ')}` })
  }

  // ── Support ─────────────────────────────────────────────────
  const { data: t } = await admin.scope(supabaseAdmin.from('support_tickets').select('*').eq('id', id)).maybeSingle()
  if (!t) return res.status(404).json({ error: 'Ticket not found' })

  const update = { status: action, replied_by: admin.id, replied_at: new Date().toISOString() }
  if (text) update.admin_reply = text
  const { error } = await supabaseAdmin.from('support_tickets').update(update).eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  if (text) await notify(t.user_id, 'support_reply', 'Support replied 💬', `Re: ${t.subject} — ${text}`)
  await audit(admin, `ticket_${action}`, 'support_ticket', id, { status: t.status }, { status: action }, text)
  return res.status(200).json({ message: `Ticket ${action.replace('_', ' ')}` })
}
