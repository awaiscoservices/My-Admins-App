// Casinoze Support — Admin Layout
// Used by all staff pages at casinozoesupport.com/admin/*

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin',              icon: 'home',    label: 'Dashboard',       roles: ['admin','super_admin','finance','game_ops','support','kyc_agent','risk','reporting','marketing'] },
    ],
  },
  {
    label: 'Players',
    items: [
      { href: '/admin/players',      icon: 'users',   label: 'Players',         roles: ['admin','super_admin','support','kyc_agent','risk','finance'] },
      { href: '/admin/kyc',          icon: 'shield',  label: 'KYC Review',      roles: ['admin','super_admin','kyc_agent','risk'] },
      { href: '/admin/risk',         icon: 'alert',   label: 'Risk Flags',      roles: ['admin','super_admin','risk','finance'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/game-accounts',icon: 'cards',   label: 'Games',           roles: ['admin','super_admin','game_ops'] },
      { href: '/admin/deposits',     icon: 'card',    label: 'Deposits',        roles: ['admin','super_admin','finance'] },
      { href: '/admin/game-loads',   icon: 'refresh', label: 'Scores',          roles: ['admin','super_admin','game_ops'] },
      { href: '/admin/redemptions',  icon: 'trophy',  label: 'Redemptions',     roles: ['admin','super_admin','game_ops','finance'] },
      { href: '/admin/withdrawals',  icon: 'out',     label: 'Withdrawals',     roles: ['admin','super_admin','finance'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/wallets',      icon: 'wallet',  label: 'Wallets',         roles: ['admin','super_admin','finance'] },
      { href: '/admin/transactions', icon: 'list',    label: 'Transactions',    roles: ['admin','super_admin','finance','reporting'] },
      { href: '/admin/adjustments',  icon: 'scale',   label: 'Adjustments',     roles: ['admin','super_admin','finance'] },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/admin/games',        icon: 'games',   label: 'Game Panels',     roles: ['admin','super_admin'] },
      { href: '/admin/payments',     icon: 'coin',    label: 'Payment Methods', roles: ['admin','super_admin','finance'] },
      { href: '/admin/promotions',   icon: 'gift',    label: 'Promotions',      roles: ['admin','super_admin','marketing'] },
      { href: '/admin/levels',       icon: 'star',    label: 'Player Levels',   roles: ['admin','super_admin','marketing'] },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/admin/support',      icon: 'chat',    label: 'Support Tickets', roles: ['admin','super_admin','support'] },
      { href: '/admin/notifications',icon: 'bell',    label: 'Notifications',   roles: ['admin','super_admin','support'] },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/staff',        icon: 'user',    label: 'Staff & Roles',   roles: ['admin','super_admin'] },
      { href: '/admin/audit-logs',   icon: 'search',  label: 'Audit Logs',      roles: ['admin','super_admin'] },
      { href: '/admin/settings',     icon: 'gear',    label: 'Settings',        roles: ['admin','super_admin'] },
    ],
  },
]

const BUILT = new Set([
  '/admin',
  '/admin/players',
  '/admin/deposits',
  '/admin/game-accounts',
  '/admin/game-loads',
  '/admin/redemptions',
  '/admin/withdrawals',
  '/admin/kyc',
  '/admin/support',
  '/admin/wallets',
  '/admin/transactions',
  '/admin/adjustments',
  '/admin/games',
  '/admin/promotions',
  '/admin/levels',
  '/admin/staff',
  '/admin/audit-logs',
  '/admin/settings',
  '/admin/risk',
  '/admin/notifications',
])

const ICONS = {
  home:    'M3 11l9-8 9 8M5 10v10h14V10',
  users:   'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8',
  shield:  'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  alert:   'M12 3l10 18H2L12 3zM12 10v5M12 18h.01',
  card:    'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM2 10h20',
  cards:   'M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zM9 9h6M9 13h6',
  refresh: 'M21 12a9 9 0 01-15.5 6.2M3 12A9 9 0 0118.5 5.8M18.5 2v4h-4M5.5 22v-4h4',
  trophy:  'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3',
  out:     'M7 17L17 7M9 7h8v8',
  wallet:  'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h11M16 13.5h.01',
  list:    'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  scale:   'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0L5 7zM19 7l-3 7a3 3 0 006 0l-3-7z',
  games:   'M6 12h4M8 10v4M15 13h.01M18 11h.01M7 7h10a4 4 0 014 4v2a4 4 0 01-4 4l-2-2H9l-2 2a4 4 0 01-4-4v-2a4 4 0 014-4z',
  coin:    'M12 21a9 9 0 100-18 9 9 0 000 18zM14.5 9.5c-.5-1-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.5-2.5-1.5M12 6.5v1.5M12 16v1.5',
  gift:    'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H8.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h3.5a2.5 2.5 0 100-5C13 2 12 7 12 7z',
  star:    'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  chat:    'M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.7A8 8 0 1121 12z',
  bell:    'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0',
  user:    'M20 21v-1a6 6 0 00-6-6h-4a6 6 0 00-6 6v1M12 11a4 4 0 100-8 4 4 0 000 8z',
  search:  'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  gear:    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  logout:  'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  menu:    'M3 6h18M3 12h18M3 18h18',
  tenants: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10',
}

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={ICONS[name] || ICONS.list} />
    </svg>
  )
}

const GOLD = '#fbbf24'

const PENDING_COLORS = {
  '/admin/deposits':      '#10b981',
  '/admin/game-accounts': '#06b6d4',
  '/admin/game-loads':    '#fbbf24',
  '/admin/redemptions':   '#f59e0b',
  '/admin/withdrawals':   '#3b82f6',
  '/admin/kyc':           '#ec4899',
  '/admin/support':       '#6366f1',
}

// 6 topbar quick-action tabs with badge counts
const TOPBAR_TABS = [
  { href: '/admin/game-accounts', label: 'Games',       color: '#06b6d4' },
  { href: '/admin/deposits',      label: 'Deposits',    color: '#10b981' },
  { href: '/admin/game-loads',    label: 'Scores',      color: '#fbbf24' },
  { href: '/admin/redemptions',   label: 'Redemptions', color: '#f59e0b' },
  { href: '/admin/withdrawals',   label: 'Withdrawals', color: '#3b82f6' },
  { href: '/admin/kyc',           label: 'KYC',         color: '#ec4899' },
]

export default function AdminLayout({ children }) {
  const router = useRouter()
  const [profile, setProfile]             = useState(null)
  const [pendingCounts, setPendingCounts] = useState({})
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [signingOut, setSigningOut]       = useState(false)
  const [authorized, setAuthorized]       = useState(false)

  useEffect(() => { loadAdminData() }, [])

  async function loadAdminData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || prof.role === 'player') { router.push('/auth/login'); return }
    setProfile(prof)
    setAuthorized(true)
    loadPendingCounts()
  }

  async function loadPendingCounts() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/admin/pending-counts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      setPendingCounts(await res.json())
    } catch (e) {
      console.error('Failed to load pending counts', e)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isActive = (href) => href === '/admin' ? router.pathname === '/admin' : router.pathname.startsWith(href)
  const canSee   = (roles) => profile && roles.includes(profile.role)

  const roleColors = {
    super_admin: '#ef4444', admin: '#fbbf24', finance: '#10b981', game_ops: '#fbbf24',
    support: '#3b82f6', kyc_agent: '#ec4899', risk: '#f97316',
    reporting: '#94a3b8', marketing: '#f59e0b',
  }
  const roleColor    = roleColors[profile?.role] || '#94a3b8'
  const currentLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => isActive(i.href))?.label || 'Dashboard'

  if (!authorized) return (
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

        {/* Left — logo + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button onClick={() => setSidebarOpen(p => !p)} className="mobile-ham" aria-label="Menu"
            style={{ display: 'none', background: 'none', border: 'none', color: GOLD, cursor: 'pointer', padding: 4 }}>
            <Icon name="menu" size={24} />
          </button>
          <Link href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Support shield icon */}
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(251,191,36,.35)', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>Casinoze <span style={{ color: GOLD }}>Support</span></div>
              <div style={{ fontSize: 9, color: 'rgba(251,191,36,.5)', letterSpacing: 2, textTransform: 'uppercase' }}>Management Portal</div>
            </div>
          </Link>
          <div className="admin-crumb" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.4)', marginLeft: 8, whiteSpace: 'nowrap' }}>
            <span style={{ margin: '0 8px 0 0', color: 'rgba(251,191,36,.4)' }}>›</span>
            <span style={{ color: '#fff' }}>{currentLabel}</span>
          </div>
        </div>

        {/* Centre — 6 quick-action tabs */}
        <div className="topbar-tabs" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {TOPBAR_TABS.map(tab => {
            const count  = pendingCounts[tab.href] || 0
            const active = isActive(tab.href)
            return (
              <Link key={tab.href} href={tab.href} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 9, textDecoration: 'none', fontSize: 11, fontWeight: 700, background: active ? `${tab.color}22` : 'rgba(255,255,255,.04)', border: `1px solid ${active ? tab.color : 'rgba(255,255,255,.1)'}`, color: active ? tab.color : 'rgba(255,255,255,.6)', whiteSpace: 'nowrap', transition: 'all .15s' }}>
                {tab.label}
                {count > 0 && (
                  <span style={{ background: tab.color, color: '#050505', fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 99, minWidth: 16, textAlign: 'center', lineHeight: '14px' }}>
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Right — refresh + role badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={loadPendingCounts} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 10, color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name="refresh" size={14} /> <span className="hide-sm">Refresh</span>
          </button>
          <div style={{ padding: '7px 12px', background: `${roleColor}18`, border: `1px solid ${roleColor}55`, borderRadius: 10, fontSize: 10, fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
            {profile?.role?.replace('_', ' ')}
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{ position: 'fixed', top: 64, left: 0, bottom: 0, width: 250, zIndex: 50, background: 'var(--panel-gradient,rgba(6,11,24,.98))', borderRight: '1px solid rgba(251,191,36,.1)', display: 'flex', flexDirection: 'column' }}>
        {profile && (
          <div style={{ margin: '14px 12px 0', padding: '10px 14px', borderRadius: 12, background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.12)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.full_name}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '.08em' }}>{profile.role.replace('_', ' ')}</div>
          </div>
        )}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px', scrollbarWidth: 'none' }}>
          {NAV_SECTIONS.map(section => {
            const visibleItems = section.items.filter(item => canSee(item.roles) && BUILT.has(item.href))
            if (visibleItems.length === 0) return null
            return (
              <div key={section.label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(251,191,36,.7)', padding: '4px 12px 8px' }}>{section.label}</div>
                {visibleItems.map(item => {
                  const active  = isActive(item.href)
                  const pending = pendingCounts[item.href] || 0
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                      className={`admin-nav${active ? ' active' : ''}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, marginBottom: 3, textDecoration: 'none', fontSize: 14, fontWeight: active ? 700 : 500, color: active ? '#050505' : 'rgba(255,255,255,.7)', background: active ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'transparent', boxShadow: active ? '0 0 20px rgba(251,191,36,.25)' : 'none' }}>
                      <Icon name={item.icon} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {pending > 0 && (
                        <span style={{ background: active ? '#050505' : (PENDING_COLORS[item.href] || '#ef4444'), color: active ? GOLD : '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>{pending}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid rgba(251,191,36,.1)' }}>
          <button onClick={handleSignOut} disabled={signingOut} style={{ width: '100%', padding: '10px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="logout" size={16} /> {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, top: 64, background: 'rgba(0,0,0,.7)', zIndex: 40 }} />}

      <div className="admin-main" style={{ marginLeft: 250, paddingTop: 64, minHeight: '100vh' }}>
        <main className="admin-content" style={{ padding: '28px', maxWidth: 1400, margin: '0 auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      <style>{`
        .admin-nav:not(.active):hover { background: rgba(251,191,36,.08) !important; color: #fff !important; }
        .admin-sidebar nav::-webkit-scrollbar { display: none; }
        .topbar-tabs a:hover { opacity: .85; }
        @media (max-width: 1200px) { .topbar-tabs { display: none !important; } }
        @media (max-width: 900px) { .admin-crumb { display: none; } }
        @media (max-width: 768px) {
          .admin-sidebar { transform: translateX(-100%); transition: transform .25s; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-main { margin-left: 0 !important; }
          .mobile-ham { display: flex !important; }
          .admin-content { padding: 16px 12px !important; }
          .hide-sm { display: none; }
        }
      `}</style>
    </div>
  )
}
