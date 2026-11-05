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

  return null
}
