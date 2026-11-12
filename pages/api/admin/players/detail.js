import { guardAdmin, loadOwnedRow, PERMS } from '../../../../lib/adminGuard'
import { maskPlayer } from '../../../../lib/playerLabel'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.PLAYER_DETAIL })
  if (!gate) return
  const supabaseAdmin = gate.db

  const { player_id } = req.query
  if (!player_id) return res.status(400).json({ error: 'player_id required' })

  // One scoped check gates the lot: confirm the player belongs to the caller's
  // casino before loading their wallet, deposits, ledger and KYC. Everything
  // below is keyed by this id, so it cannot reach another casino's data.
  const { row: owned } = await loadOwnedRow(gate, 'profiles', player_id, 'id')
  if (!owned) return res.status(404).json({ error: 'Player not found' })

  // Ownership is already confirmed above, so these can run unscoped.
  const [
    { data: profile, error: profileErr },
    { data: wallet, error: walletErr },
    { data: deposits, error: depositsErr },
    { data: gameAccounts, error: gaErr },
    { data: ledger, error: ledgerErr },
    { data: kyc, error: kycErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', player_id)
      .single(),

    supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', player_id)
      .single(),

    supabaseAdmin
      .from('deposits')
      .select('*, payment_methods(name)')
      .eq('user_id', player_id)
      .order('created_at', { ascending: false })
      .limit(20),

    supabaseAdmin
      .from('game_accounts')
      .select('*, game_panels(name, accent_color)')
      .eq('user_id', player_id)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('ledger')
      .select('*')
      .eq('user_id', player_id)
      .order('created_at', { ascending: false })
      .limit(30),

    supabaseAdmin
      .from('kyc_records')
      .select('*')
      .eq('user_id', player_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (profileErr || !profile) {
    return res.status(404).json({ error: 'Player not found' })
  }

  return res.status(200).json({
    profile: maskPlayer(profile),
    wallet: wallet || null,
    deposits: deposits || [],
    game_accounts: gameAccounts || [],
    ledger: ledger || [],
    kyc: kyc || null,
  })
}
