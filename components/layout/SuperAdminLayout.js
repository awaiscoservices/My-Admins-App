/**
 * components/layout/SuperAdminLayout.js
 *
 * Layout for the Super Admin portal (/superadmin/*).
 * Separate from AdminLayout — super_admin role only.
 * Verifies role client-side; API routes enforce server-side.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

const G     = '#fbbf24'
const G2    = '#f59e0b'
const NAV_W = 220

const NAV_ITEMS = [
  { href: '/superadmin',          icon: '🏠', label: 'Dashboard'  },
  { href: '/superadmin/tenants',  icon: '🏢', label: 'Tenants'    },
  { href: '/superadmin/billing',  icon: '💳', label: 'Billing'    },
  { href: '/superadmin/audit',    icon: '📋', label: 'Audit Logs' },
  { href: '/superadmin/settings', icon: '⚙️',  label: 'Settings'  },
]

export default function SuperAdminLayout({ children, title }) {
  const router   = useRouter()
  const [user, setUser]   = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', session.user.id)
        .single()

      if (profile?.role !== 'super_admin') {
        router.replace('/admin')
        return
      }

      setUser({ ...session.user, ...profile })
      setReady(true)
    })
  }, [])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: '#080d14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: G, fontFamily: "'Outfit',sans-serif", fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  const path = router.pathname

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080d14', fontFamily: "'Outfit',sans-serif" }}>

      {/* Sidebar */}
      <aside style={{
        width: NAV_W, flexShrink: 0, background: 'rgba(255,255,255,.02)',
        borderRight: '1px solid rgba(255,255,255,.07)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo / branding */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ color: G, fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            ⚡ Super Admin
          </div>
          <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 11, marginTop: 3 }}>
            Casinoze Platform
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = path === href || (href !== '/superadmin' && path.startsWith(href))
            return (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                  background: active ? 'rgba(251,191,36,.12)' : 'transparent',
                  border: active ? '1px solid rgba(251,191,36,.2)' : '1px solid transparent',
                  color: active ? G : 'rgba(255,255,255,.55)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  transition: 'all .15s',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
                  {label}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Back to admin link */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              color: 'rgba(255,255,255,.35)', fontSize: 12,
            }}>
              ← Back to Admin
            </div>
          </Link>
        </div>

        {/* User chip */}
        <div style={{
          padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontWeight: 800, fontSize: 12, flexShrink: 0,
          }}>
            {(user?.full_name || user?.email || 'S')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name || 'Super Admin'}
            </div>
            <div style={{ color: G, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              super_admin
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {/* Top bar */}
        {title && (
          <div style={{
            padding: '20px 32px 0',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            paddingBottom: 20,
            marginBottom: 0,
          }}>
            <h1 style={{ color: '#fff', fontFamily: "'Cinzel',serif", fontSize: 22, margin: 0 }}>
              {title}
            </h1>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
