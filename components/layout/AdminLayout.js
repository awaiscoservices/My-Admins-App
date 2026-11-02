import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import Logo from '../ui/Logo'

// ─── Navigation ──────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin',              icon: 'home',    label: 'Dashboard',       roles: ['super_admin','admin','finance','game_ops','support','kyc_agent','risk','reporting','marketing'] },
    ],
  },
  {
    label: 'Players',
    items: [
      { href: '/admin/players',      icon: 'users',   label: 'Players',         roles: ['super_admin','admin','support','kyc_agent','risk','finance','reporting','marketing'] },
      { href: '/admin/kyc',          icon: 'shield',  label: 'KYC Review',      roles: ['super_admin','admin','kyc_agent','risk'] },
      { href: '/admin/risk',         icon: 'alert',   label: 'Risk Flags',      roles: ['super_admin','admin','risk','finance'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/deposits',     icon: 'card',    label: 'Deposit',         roles: ['super_admin','admin','finance'] },
      { href: '/admin/game-accounts',icon: 'cards',   label: 'Game Accounts',   roles: ['super_admin','admin','game_ops'] },
      { href: '/admin/game-loads',   icon: 'refresh', label: 'Scores',          roles: ['super_admin','admin','game_ops'] },
      { href: '/admin/redemptions',  icon: 'trophy',  label: 'Redeems',         roles: ['super_admin','admin','game_ops','finance'] },
      { href: '/admin/withdrawals',  icon: 'out',     label: 'Withdraw',        roles: ['super_admin','admin','finance'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/wallets',      icon: 'wallet',  label: 'Wallets',         roles: ['super_admin','admin','finance'] },
      { href: '/admin/transactions', icon: 'list',    label: 'Transactions',    roles: ['super_admin','admin','finance','reporting'] },
      { href: '/admin/adjustments',  icon: 'scale',   label: 'Adjustments',     roles: ['super_admin','admin','finance'] },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/admin/games',        icon: 'games',   label: 'Game Panels',     roles: ['super_admin'] },
      { href: '/admin/payments',     icon: 'coin',    label: 'Payment Methods', roles: ['super_admin','finance'] },
      { href: '/admin/promotions',   icon: 'gift',    label: 'Promotions',      roles: ['super_admin','marketing'] },
      { href: '/admin/levels',       icon: 'star',    label: 'Player Levels',   roles: ['super_admin','marketing'] },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/admin/support',      icon: 'chat',    label: 'Support Tickets', roles: ['super_admin','admin','support'] },
      { href: '/admin/notifications',icon: 'bell',    label: 'Notifications',   roles: ['super_admin','admin','support'] },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/staff',        icon: 'user',    label: 'Staff & Roles',   roles: ['super_admin'] },
      { href: '/admin/audit-logs',   icon: 'search',  label: 'Audit Logs',      roles: ['super_admin'] },
      { href: '/admin/settings',     icon: 'gear',    label: 'Settings',        roles: ['super_admin'] },
    ],
  },
]

const BUILT = new Set([
  '/admin', '/admin/players', '/admin/deposits', '/admin/game-accounts',
  '/admin/game-loads', '/admin/redemptions', '/admin/withdrawals',
  '/admin/kyc', '/admin/support', '/admin/wallets', '/admin/transactions',
  '/admin/adjustments', '/admin/games', '/admin/promotions', '/admin/levels',
  '/admin/staff', '/admin/audit-logs', '/admin/settings', '/admin/risk',
  '/admin/notifications',
])

// Header badge button definitions — 6 fixed buttons
const HEADER_BADGES = [
  { key: 'deposit_requests',  label: 'Deposit',  href: '/admin/deposits',      color: '#10b981' },
  { key: 'withdraw_requests', label: 'Withdraw', href: '/admin/withdrawals',   color: '#3b82f6' },
  { key: 'scores_requests',   label: 'Scores',   href: '/admin/game-loads',    color: '#fbbf24' },
  { key: 'redeem_requests',   label: 'Redeems',  href: '/admin/redemptions',   color: '#f59e0b' },
  { key: 'kyc_requests',      label: 'KYC',      href: '/admin/kyc',           color: '#ec4899' },
  { key: 'game_requests',     label: 'Games',    href: '/admin/game-accounts', color: '#06b6d4' },
]

// Roles that can see each badge (mirrors the page roles)
const BADGE_ROLES = {
  deposit_requests:  ['super_admin','admin','finance'],
  withdraw_requests: ['super_admin','admin','finance'],
  scores_requests:   ['super_admin','admin','game_ops'],
  redeem_requests:   ['super_admin','admin','game_ops','finance'],
  kyc_requests:      ['super_admin','admin','kyc_agent','risk'],
  game_requests:     ['super_admin','admin','game_ops'],
}

// ─── Icons ────────────────────────────────────────────────────────────────────
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
  globe:   'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18',
  menu:    'M3 6h18M3 12h18M3 18h18',
  chevron: 'M6 9l6 6 6-6',
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

const ROLE_COLORS = {
  super_admin: '#ef4444', admin: '#f97316', finance: '#10b981', game_ops: '#fbbf24',
  support: '#3b82f6', kyc_agent: '#ec4899', risk: '#f97316',
  reporting: '#94a3b8', marketing: '#f59e0b',
}

function roleLabel(role) {
  if (!role) return ''
  return role.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ─── Profile Dropdown ─────────────────────────────────────────────────────────
function ProfileDropdown({ profile, onSignOut, signingOut }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const roleColor = ROLE_COLORS[profile?.role] || '#94a3b8'

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!profile) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 10px', background: open ? 'rgba(251,191,36,.12)' : 'rgba(255,255,255,.05)', border: `1px solid ${open ? 'rgba(251,191,36,.45)' : 'rgba(251,191,36,.2)'}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        {/* Avatar */}
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor},${roleColor}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#050505', flexShrink: 0 }}>
          {initials(profile.full_name)}
        </div>
        <div className="hide-sm" style={{ textAlign: 'left', minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{profile.full_name}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '.08em' }}>{roleLabel(profile.role)}</div>
        </div>
        <div className="hide-sm" style={{ color: 'rgba(255,255,255,.4)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <Icon name="chevron" size={14} />
        </div>
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 260, background: 'rgba(15,18,30,.98)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,.7)', zIndex: 200, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor},${roleColor}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#050505', flexShrink: 0 }}>
              {initials(profile.full_name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{roleLabel(profile.role)}</div>
            </div>
          </div>

          {/* Details */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            {profile.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 16, color: 'rgba(255,255,255,.35)', flexShrink: 0 }}>@</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</div>
              </div>
            )}
            {profile.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 16, color: 'rgba(255,255,255,.35)', flexShrink: 0, fontSize: 14 }}>✆</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)' }}>{profile.phone}</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding: '8px' }}>
            <Link href="/admin/profile" onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, textDecoration: 'none', color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 500 }}
              className="dropdown-item">
              <Icon name="user" size={15} /> View Profile
            </Link>
            <Link href="/admin/settings" onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, textDecoration: 'none', color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 500 }}
              className="dropdown-item">
              <Icon name="gear" size={15} /> Settings
            </Link>
            <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '6px 0' }} />
            <button onClick={() => { setOpen(false); onSignOut() }} disabled={signingOut}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'none', border: 'none', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              className="dropdown-item-danger">
              <Icon name="logout" size={15} /> {signingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function AdminLayout({ children }) {
  const router = useRouter()
  const [profile, setProfile]             = useState(null)
  const [pendingCounts, setPendingCounts] = useState({})
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [signingOut, setSigningOut]       = useState(false)
  const [authorized, setAuthorized]       = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    loadAdminData()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  async function loadAdminData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || prof.role === 'player') { router.push('/dashboard'); return }

    setProfile(prof)
    setAuthorized(true)

    // Load counts immediately, then poll every 60 s
    fetchPendingCounts()
    pollRef.current = setInterval(fetchPendingCounts, 60_000)
  }

  async function fetchPendingCounts() {
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch('/api/admin/pending-counts', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      setPendingCounts(await res.json())
    } catch (e) {
      console.error('pending-counts error', e)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isActive = (href) => href === '/admin' ? router.pathname === '/admin' : router.pathname.startsWith(href)
  const canSee   = (roles) => profile && roles.includes(profile.role)
  const roleColor = ROLE_COLORS[profile?.role] || '#94a3b8'
  const currentLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => isActive(i.href))?.label || 'Admin'

  if (!authorized) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit',sans-serif" }}>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)' }}>
        <div style={{ marginBottom: 12, color: GOLD }}><Icon name="shield" size={36} /></div>
        <div>Verifying access…</div>
      </div>
    </div>
  )

  // Header badge buttons visible to this role
  const visibleBadges = HEADER_BADGES.filter(b =>
    BADGE_ROLES[b.key]?.includes(profile?.role)
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', backgroundAttachment: 'fixed', fontFamily: "'Outfit', sans-serif", color: '#fff' }}>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 16px', background: 'var(--panel-gradient)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(251,191,36,.18)', boxShadow: '0 4px 24px rgba(0,0,0,.6)' }}>

        {/* Left — Logo + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(p => !p)} className="mobile-ham" aria-label="Menu"
            style={{ display: 'none', background: 'none', border: 'none', color: GOLD, cursor: 'pointer', padding: 4 }}>
            <Icon name="menu" size={24} />
          </button>
          <Link href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="admin-logo-full"><Logo variant="full" height={38} /></span>
            <span className="admin-logo-icon"><Logo variant="icon" height={38} /></span>
            <span style={{ padding: '3px 8px', borderRadius: 6, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#050505', fontSize: 10, fontWeight: 800, letterSpacing: '.12em' }}>ADMIN</span>
          </Link>
          <div className="admin-crumb" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.4)' }}>
            <span style={{ margin: '0 8px 0 0', color: 'rgba(251,191,36,.4)' }}>›</span>
            <span style={{ color: '#fff' }}>{currentLabel}</span>
          </div>
        </div>

        {/* Centre — 6 notification badge buttons */}
        {visibleBadges.length > 0 && (
          <div className="header-badges" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {visibleBadges.map(b => {
              const count = pendingCounts[b.key] || 0
              const isCurrentPage = router.pathname.startsWith(b.href)
              return (
                <Link key={b.key} href={b.href}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: isCurrentPage ? `${b.color}20` : (count > 0 ? `${b.color}12` : 'rgba(255,255,255,.04)'), border: `1px solid ${isCurrentPage ? b.color + '60' : (count > 0 ? b.color + '40' : 'rgba(255,255,255,.1)')}`, borderRadius: 10, textDecoration: 'none', color: count > 0 ? '#fff' : 'rgba(255,255,255,.4)', fontSize: 11, fontWeight: count > 0 ? 700 : 500, whiteSpace: 'nowrap', transition: 'all .15s' }}
                  className="badge-btn">
                  <span>{b.label}</span>
                  {count > 0 && (
                    <span style={{ background: b.color, color: '#050505', fontSize: 10, fontWeight: 900, padding: '1px 6px', borderRadius: 99, lineHeight: 1.5 }}>{count > 99 ? '99+' : count}</span>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Right — Profile dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ProfileDropdown profile={profile} onSignOut={handleSignOut} signingOut={signingOut} />
        </div>
      </header>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}
        style={{ position: 'fixed', top: 64, left: 0, bottom: 0, width: 250, zIndex: 50, background: 'var(--panel-gradient)', borderRight: '1px solid rgba(251,191,36,.1)', display: 'flex', flexDirection: 'column' }}>

        {/* Sidebar staff card */}
        {profile && (
          <div style={{ margin: '14px 12px 0', padding: '10px 14px', borderRadius: 12, background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${roleColor},${roleColor}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#050505', flexShrink: 0 }}>
              {initials(profile.full_name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.full_name}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: roleColor, textTransform: 'uppercase', letterSpacing: '.08em' }}>{roleLabel(profile.role)}</div>
            </div>
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
                  // Map sidebar hrefs to new pending-counts keys
                  const badgeKey = {
                    '/admin/deposits':      'deposit_requests',
                    '/admin/withdrawals':   'withdraw_requests',
                    '/admin/game-loads':    'scores_requests',
                    '/admin/redemptions':   'redeem_requests',
                    '/admin/kyc':           'kyc_requests',
                    '/admin/game-accounts': 'game_requests',
                  }[item.href]
                  const pending = badgeKey ? (pendingCounts[badgeKey] || 0) : 0
                  const badgeColor = HEADER_BADGES.find(b => b.key === badgeKey)?.color || '#ef4444'
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                      className={`admin-nav${active ? ' active' : ''}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, marginBottom: 3, textDecoration: 'none', fontSize: 14, fontWeight: active ? 700 : 500, color: active ? '#050505' : 'rgba(255,255,255,.7)', background: active ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'transparent', boxShadow: active ? '0 0 20px rgba(251,191,36,.25)' : 'none' }}>
                      <Icon name={item.icon} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {pending > 0 && (
                        <span style={{ background: active ? '#050505' : badgeColor, color: active ? GOLD : '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>{pending > 99 ? '99+' : pending}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid rgba(251,191,36,.1)' }}>
          <Link href="/" className="admin-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, textDecoration: 'none', marginBottom: 8, color: 'rgba(255,255,255,.7)', fontSize: 14, fontWeight: 500 }}>
            <Icon name="globe" /> View Site
          </Link>
          <button onClick={handleSignOut} disabled={signingOut}
            style={{ width: '100%', padding: '10px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
        .admin-logo-icon { display: none; }
        .badge-btn:hover { opacity: .85; }
        .dropdown-item:hover { background: rgba(255,255,255,.06) !important; }
        .dropdown-item-danger:hover { background: rgba(239,68,68,.1) !important; }

        @media (max-width: 1200px) {
          .header-badges .badge-btn span:first-child { display: none; }
        }
        @media (max-width: 900px) {
          .admin-logo-full  { display: none; }
          .admin-logo-icon  { display: inline-flex; }
          .admin-crumb      { display: none; }
          .header-badges    { gap: 2; }
          .header-badges .badge-btn { padding: 6px 7px; }
        }
        @media (max-width: 768px) {
          .admin-sidebar    { transform: translateX(-100%); transition: transform .25s; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-main       { margin-left: 0 !important; }
          .mobile-ham       { display: flex !important; }
          .admin-content    { padding: 16px 12px !important; }
          .hide-sm          { display: none !important; }
          .header-badges    { display: none; }
        }
      `}</style>
    </div>
  )
}
