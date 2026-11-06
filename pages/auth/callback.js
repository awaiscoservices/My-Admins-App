import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // getSession() waits for the OAuth code exchange to finish and
    // writes the session cookie before we redirect.
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? '/dashboard' : '/auth/login')
    })
  }, [router])

  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-gradient)', color: '#fbbf24', fontFamily: 'Outfit, sans-serif', fontWeight: 600, letterSpacing: '.06em' }}>Signing you in…</div>
}
