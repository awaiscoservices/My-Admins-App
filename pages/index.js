/**
 * Casinoze Support has no public landing page — it is a staff tool.
 *
 * This is the single role-aware entry point. Everything that needs to send a
 * signed-in person "somewhere sensible" points here rather than hardcoding
 * /admin, so super admins are not dropped into the tenant admin panel.
 *
 *   super_admin  -> /superadmin   (manages all tenants)
 *   other staff  -> /admin        (works inside one tenant)
 *   signed out   -> /auth/login
 */
import { createPagesServerClient } from '../lib/supabaseServer'

export default function Index() { return null }

const SIGN_IN = { redirect: { destination: '/auth/login', permanent: false } }

export async function getServerSideProps({ req, res }) {
  try {
    const supabase = createPagesServerClient({ req, res })

    // getSession here is the wrapper in lib/supabaseServer.js, which re-checks
    // the token with Supabase rather than trusting the cookie.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return SIGN_IN

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!profile?.role || profile.role === 'player') return SIGN_IN

    return {
      redirect: {
        destination: profile.role === 'super_admin' ? '/superadmin' : '/admin',
        permanent: false,
      },
    }
  } catch {
    // Never leave the domain root broken: fall back to the sign-in page.
    return SIGN_IN
  }
}
