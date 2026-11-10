/**
 * POST /api/auth/resolve-username
 * Body: { username }
 *
 * Supabase Auth signs in with an email, so a username has to be turned into
 * one before the browser can call signInWithPassword. profiles.username holds
 * the real username; the email behind a username-only account is internal and
 * never used for mail.
 *
 * This only maps a username to the address to sign in with. It does not check
 * the password and never creates a session — Supabase still does that, so a
 * valid username here gets you no further without the right password.
 *
 * It does confirm whether a username exists, which is unavoidable for this
 * flow. That is acceptable for a staff portal with a handful of accounts and
 * no public sign-up; it would not be for a consumer login.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { username } = req.body || {}
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username required' })
  }

  const clean = username.trim().toLowerCase()
  if (!clean) return res.status(400).json({ error: 'username required' })

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('email, role')
    .ilike('username', clean)
    .maybeSingle()

  // Same message either way, so this cannot be used to tell a missing
  // username apart from a player's account.
  if (error || !data?.email || data.role === 'player') {
    return res.status(404).json({ error: 'No staff account with that username' })
  }

  return res.status(200).json({ email: data.email })
}
