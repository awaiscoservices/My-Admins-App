import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['super_admin', 'admin', 'finance', 'support', 'kyc_agent', 'risk']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: actor, error: actorErr } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (actorErr || !actor || !ALLOWED_ROLES.includes(actor.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { player_id } = req.query
  if (!player_id) return res.status(400).json({ error: 'player_id required' })

  // Fetch all player data in parallel using service role (bypasses RLS)
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
    profile,
    wallet: wallet || null,
    deposits: deposits || [],
    game_accounts: gameAccounts || [],
    ledger: ledger || [],
    kyc: kyc || null,
  })
}
