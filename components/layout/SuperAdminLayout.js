/**
 * components/layout/SuperAdminLayout.js
 *
 * Layout for the Super Admin portal (/superadmin/*), super_admin only.
 * Role is verified here for the UI; every API route enforces it again
 * server-side through guardSuperAdmin.
 *
 * Deliberately mirrors AdminLayout: same top bar, same hover-expanding icon
 * rail, same colours and spacing, so moving between the two portals does not
 * feel like moving between two products.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'

const GOLD = '#fbbf24'

const ICONS = {
  home:    'M3 11l9-8 9 8M5 10v10h14V10',
  tenants: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
  card:    'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM2 10h20',
  search:  'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  gear:    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  back:    'M19 12H5M12 19l-7-7 7-7',
  logout:  'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  menu:    'M3 6h18M3 12h18M3 18h18',
  shield:  'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={ICONS[name] || ICONS.home} />
    </svg>
  )
}

const NAV_SECTIONS = [
  {
    label: 'Platform',
    items: [
      { href: '/superadmin',          icon: 'home',    label: 'Dashboard'  },
      { href: '/superadmin/tenants',  icon: 'tenants', label: 'Tenants'    },
    ],
  },
  {
    label: 'Coming soon',
    items: [
      { href: '/superadmin/billing',  icon: 'card',   label: 'Billing'    },
      { href: '/superadmin/audit',    icon: 'search', label: 'Audit Logs' },
      { href: '/superadmin/settings', icon: 'gear',   label: 'Settings'   },
    ],
  },
]

// Only these pages exist. The rest render as disabled rows rather than links,
// because a nav item that 404s is worse than one that says "soon".
const BUILT = new Set(['/superadmin', '/superadmin/tenants'])

export default function SuperAdminLayout({ children, title }) {
  const router = useRouter()
  const [profile, setProfile]         = useState(null)
  const [ready, setReady]             = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut]   = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/auth/login'); return }

        const { data: prof } = await supabase
          .from('profiles')
          .select('role, full_name, email')
          .eq('id', session.user.id)
          .single()

        if (prof?.role !== 'super_admin') { router.replace('/admin'); return }

        setProfile(prof)
        setReady(true)
      } catch {
        router.replace('/auth/login')
      }
    })()
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isActive = (href) =>
    href === '/superadmin' ? router.pathname === '/superadmin' : router.pathname.startsWith(href)

  const currentLabel =
    title || NAV_SECTIONS.flatMap(s => s.items).find(i => isActive(i.href))?.label || 'Dashboard'

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: '#060b18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit',sans-serif" }}>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.4)' }}>
        <div style={{ marginBottom: 12, color: GOLD }}><Icon name="shield" size={36} /></div>
        <div>Verifying access…</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient,#060b18)', backgroundAttachment: 'fixed', fontFamily: "'Outfit', sans-serif", color: '#fff' }}>
      <Head>
        <title>Casinoze Support</title>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      {/* TOP BAR */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 20px', background: 'var(--panel-gradient,rgba(6,11,24,.95))', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(251,191,36,.18)', boxShadow: '0 4px 24px rgba(0,0,0,.6)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button onClick={() => setSidebarOpen(p => !p)} className="mobile-ham" aria-label="Menu"
            style={{ display: 'none', background: 'none', border: 'none', color: GOLD, cursor: 'pointer', padding: 4 }}>
            <Icon name="menu" size={24} />
          </button>
          <Link href="/superadmin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(251,191,36,.35)', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS.shield} />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              Casinoze <span style={{ color: GOLD }}>Support</span>
            </div>
          </Link>
          <div className="admin-crumb" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.4)', marginLeft: 8, whiteSpace: 'nowrap' }}>
            <span style={{ margin: '0 8px 0 0', color: 'rgba(251,191,36,.4)' }}>›</span>
            <span style={{ color: '#fff' }}>{currentLabel}</span>
          </div>
        </div>

        {/* Right — back to admin + role badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/admin" className="hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 10, color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            <Icon name="back" size={14} /> Admin Panel
          </Link>
          <div style={{ padding: '7px 12px', background: '#ef444418', border: '1px solid #ef444455', borderRadius: 10, fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
            super admin
          </div>
        </div>
      </header>

      {/* SIDEBAR — icon rail, expands on hover */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{ position: 'fixed', top: 64, left: 0, bottom: 0, zIndex: 50, background: 'var(--panel-gradient,rgba(6,11,24,.98))', borderRight: '1px solid rgba(251,191,36,.1)', display: 'flex', flexDirection: 'column' }}>

        {/* No identity card here — the top bar carries it. */}

        <nav style={{ flex: 1, overflowY: 'auto', padding: 12, scrollbarWidth: 'none' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label} style={{ marginBottom: 16 }}>
              <div className="rail-label rail-section" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(251,191,36,.7)', padding: '4px 12px 8px', whiteSpace: 'nowrap' }}>{section.label}</div>
              {section.items.map(item => {
                const active = isActive(item.href)
                const built  = BUILT.has(item.href)

                if (!built) return (
                  <div key={item.href} title={`${item.label} — not built yet`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, marginBottom: 3, fontSize: 14, color: 'rgba(255,255,255,.25)', cursor: 'not-allowed' }}>
                    <Icon name={item.icon} />
                    <span className="rail-label" style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
                    <span className="rail-label" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 99, padding: '1px 6px', flexShrink: 0 }}>soon</span>
                  </div>
                )

                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                    title={item.label}
                    className={`admin-nav${active ? ' active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, marginBottom: 3, textDecoration: 'none', fontSize: 14, fontWeight: active ? 700 : 500, color: active ? '#050505' : 'rgba(255,255,255,.7)', background: active ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'transparent', boxShadow: active ? '0 0 20px rgba(251,191,36,.25)' : 'none' }}>
                    <Icon name={item.icon} />
                    <span className="rail-label" style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid rgba(251,191,36,.1)' }}>
          <button onClick={handleSignOut} disabled={signingOut}
            style={{ width: '100%', padding: '10px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="logout" size={16} />
            <span className="rail-label" style={{ whiteSpace: 'nowrap' }}>{signingOut ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, top: 64, background: 'rgba(0,0,0,.7)', zIndex: 40 }} />}

      <div className="admin-main" style={{ marginLeft: 72, paddingTop: 64, minHeight: '100vh' }}>
        <main className="admin-content" style={{ padding: 28, maxWidth: 1400, margin: '0 auto', overflowX: 'hidden' }}>
          {title && (
            <h1 style={{ color: '#fff', fontFamily: "'Cinzel',serif", fontSize: 24, margin: '0 0 24px' }}>{title}</h1>
          )}
          {children}
        </main>
      </div>

      <style>{`
        /* Icon rail: 72px of icons, expands to 250px on hover and overlays the
           page, so the content never shifts. Labels fade with the width. */
        .admin-sidebar {
          width: 72px;
          overflow: hidden;
          transition: width .18s ease;
        }
        .admin-sidebar:hover,
        .admin-sidebar:focus-within { width: 250px; box-shadow: 8px 0 32px rgba(0,0,0,.55); }

        .admin-sidebar .rail-label {
          opacity: 0;
          transition: opacity .12s ease;
          pointer-events: none;
        }
        .admin-sidebar:hover .rail-label,
        .admin-sidebar:focus-within .rail-label { opacity: 1; pointer-events: auto; }

        .admin-sidebar .rail-section { height: 0; padding-top: 0 !important; padding-bottom: 0 !important; overflow: hidden; transition: height .18s ease, padding .18s ease; }
        .admin-sidebar:hover .rail-section,
        .admin-sidebar:focus-within .rail-section { height: 22px; padding: 4px 12px 8px !important; }

        .admin-nav:not(.active):hover { background: rgba(251,191,36,.08) !important; color: #fff !important; }
        .admin-sidebar nav::-webkit-scrollbar { display: none; }

        @media (max-width: 900px) { .admin-crumb { display: none; } }
        @media (max-width: 768px) {
          .admin-sidebar { width: 250px !important; transform: translateX(-100%); transition: transform .25s; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-sidebar .rail-label { opacity: 1 !important; pointer-events: auto !important; }
          .admin-sidebar .rail-section { height: auto !important; padding: 4px 12px 8px !important; }
          .admin-main { margin-left: 0 !important; }
          .mobile-ham { display: flex !important; }
          .admin-content { padding: 16px 12px !important; }
          .hide-sm { display: none !important; }
        }
      `}</style>
    </div>
  )
}
