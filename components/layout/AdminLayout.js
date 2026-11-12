// Casinoze Support — Admin Layout
// Used by all staff pages at casinozoesupport.com/admin/*

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import TwoFactorSetup from '../TwoFactorSetup'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    icon: 'grid',
    items: [
      { href: '/admin',              icon: 'home',    label: 'Dashboard',       roles: ['admin','super_admin','finance','game_ops','support','kyc_agent','risk','reporting','marketing'] },
    ],
  },
  {
    label: 'Players',
    icon: 'users',
    items: [
      { href: '/admin/players',      icon: 'users',   label: 'Players',         roles: ['admin','super_admin','support','kyc_agent','risk','finance'] },
      { href: '/admin/kyc',          icon: 'shield',  label: 'KYC Review',      roles: ['admin','super_admin','kyc_agent','risk'] },
      { href: '/admin/risk',         icon: 'alert',   label: 'Risk Flags',      roles: ['admin','super_admin','risk','finance'] },
    ],
  },
  {
    label: 'Operations',
    icon: 'layers',
    items: [
      { href: '/admin/game-accounts',icon: 'cards',   label: 'Games',           roles: ['admin','super_admin','game_ops'] },
      { href: '/admin/deposits',     icon: 'card',    label: 'Deposits',        roles: ['admin','super_admin','finance'] },
      { href: '/admin/game-loads',   icon: 'refresh', label: 'Scores',          roles: ['admin','super_admin','game_ops'] },
      { href: '/admin/redemptions',  icon: 'trophy',  label: 'Redeem',          roles: ['admin','super_admin','game_ops','finance'] },
      { href: '/admin/withdrawals',  icon: 'out',     label: 'Withdraw',        roles: ['admin','super_admin','finance'] },
    ],
  },
  {
    label: 'Finance',
    icon: 'coin',
    items: [
      { href: '/admin/wallets',      icon: 'wallet',  label: 'Wallets',         roles: ['admin','super_admin','finance'] },
      { href: '/admin/transactions', icon: 'list',    label: 'Transactions',    roles: ['admin','super_admin','finance','reporting'] },
      { href: '/admin/adjustments',  icon: 'scale',   label: 'Adjustments',     roles: ['admin','super_admin','finance'] },
    ],
  },
  {
    label: 'Configuration',
    icon: 'gear',
    items: [
      { href: '/admin/games',        icon: 'games',   label: 'Game Panels',     roles: ['admin','super_admin'] },
      { href: '/admin/payments',     icon: 'coin',    label: 'Payment Methods', roles: ['admin','super_admin','finance'] },
      { href: '/admin/promotions',   icon: 'gift',    label: 'Player Bonuses',  roles: ['admin','super_admin','marketing'] },
      { href: '/admin/levels',       icon: 'star',    label: 'Player Levels',   roles: ['admin','super_admin','marketing'] },
    ],
  },
  {
    label: 'Support',
    icon: 'chat',
    items: [
      { href: '/admin/chat',         icon: 'chat',    label: 'Live Chat',       roles: ['admin','super_admin','support'] },
      { href: '/admin/notifications',icon: 'bell',    label: 'Notifications',   roles: ['admin','super_admin','support'] },
    ],
  },
  {
    label: 'System',
    icon: 'shield',
    items: [
      { href: '/admin/staff',        icon: 'user',    label: 'Staff & Roles',   roles: ['admin','super_admin'] },
      { href: '/admin/audit-logs',   icon: 'search',  label: 'Audit Logs',      roles: ['admin','super_admin'] },
      { href: '/admin/settings',     icon: 'gear',    label: 'Settings',        roles: ['admin','super_admin'] },
    ],
  },
]

// There used to be a hand-written BUILT set here that the sidebar filtered
// every link through, to hide links to pages that did not exist yet. Every
// page in NAV exists now, and /admin/payments was simply never added to the
// set — so Payment Methods was invisible in the sidebar and unreachable,
// which is why "+ Add Method" could not be found. A list that has to be
// updated by hand whenever a page is added will go stale again, so links are
// now filtered by role alone.

const ICONS = {
  clock:    'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  layers:   'M12 3l9 5-9 5-9-5 9-5zM3 14l9 5 9-5M3 10.5l9 5 9-5',
  grid:     'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
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
  '/admin/chat':          '#8b5cf6',
}

// 7 topbar quick-action tabs with badge counts
const TOPBAR_TABS = [
  { href: '/admin/game-accounts', label: 'Games',       color: '#06b6d4' },
  { href: '/admin/deposits',      label: 'Deposits',    color: '#10b981' },
  { href: '/admin/game-loads',    label: 'Scores',      color: '#fbbf24' },
  { href: '/admin/redemptions',   label: 'Redeem', color: '#f59e0b' },
  { href: '/admin/withdrawals',   label: 'Withdraw', color: '#3b82f6' },
  { href: '/admin/kyc',           label: 'KYC',         color: '#ec4899' },
  { href: '/admin/chat',          label: 'Support',     color: '#8b5cf6' },
]

export default function AdminLayout({ children }) {
  const router = useRouter()
  const [profile, setProfile]             = useState(null)
  const [pendingCounts, setPendingCounts] = useState({})
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [signingOut, setSigningOut]       = useState(false)
  const [authorized, setAuthorized]       = useState(false)
  const [me, setMe]                       = useState(null)
  const [menuOpen, setMenuOpen]           = useState(false)
  const [show2fa, setShow2fa]             = useState(false)
  const [force2fa, setForce2fa]           = useState(false)

  useEffect(() => { loadAdminData() }, [])

  async function loadAdminData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || prof.role === 'player') { router.push('/auth/login'); return }
    setProfile(prof)
    setAuthorized(true)
    loadPendingCounts()
    loadMe()
    enforce2fa()
  }

  // If the casino requires 2FA and this account has not set it up, make them
  // do it before they can use the panel. The modal cannot be dismissed. A
  // super admin is not forced — they manage the requirement itself.
  async function enforce2fa() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/admin/settings/get', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!res.ok) return
      const { settings } = await res.json()
      const req = settings.find(s => s.key === 'two_factor_required')?.value
      if (!(req === true || req === 'true')) return
      const { data: fl } = await supabase.auth.mfa.listFactors()
      const hasFactor = (fl?.totp || []).some(f => f.status === 'verified')
      if (!hasFactor) { setForce2fa(true); setShow2fa(true) }
    } catch { /* never block the panel on a failed check */ }
  }

  // The casino's name is not readable from the browser, so it comes from
  // the server along with the rest of the account's details.
  async function loadMe() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/admin/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (res.ok) setMe(await res.json())
    } catch (e) {
      console.error('Failed to load account details', e)
    }
  }

  // Click anywhere else and the menu closes.
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

  // Keep the topbar/sidebar badges live: re-count every 8s so a new request
  // lights the tab and an approved one clears it, without a page reload.
  useEffect(() => {
    const t = setInterval(() => loadPendingCounts(), 8000)
    return () => clearInterval(t)
  }, [])

  // Opening a chat marks its messages read, so the Support badge should drop
  // immediately — not on the next 8s tick. The chat page fires this event: we
  // clear the badge at once (optimistic) and re-count from the server to catch
  // any other chats that still have unread messages.
  useEffect(() => {
    const onChatOpened = () => {
      setPendingCounts(prev => ({ ...prev, '/admin/chat': 0 }))
      loadPendingCounts()
    }
    window.addEventListener('admin:chat-opened', onChatOpened)
    return () => window.removeEventListener('admin:chat-opened', onChatOpened)
  }, [])

  async function loadPendingCounts() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/admin/pending-counts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })
      if (!res.ok) return

      // The badges are looked up by href, but the route answers with its own
      // names — deposit_requests, not /admin/deposits. Every lookup came back
      // undefined, so no badge had ever appeared. Translate once, here.
      const d = await res.json()
      setPendingCounts({
        '/admin/deposits':      d.deposit_requests  || 0,
        '/admin/withdrawals':   d.withdraw_requests || 0,
        '/admin/game-loads':    d.scores_requests   || 0,
        '/admin/redemptions':   d.redeem_requests   || 0,
        '/admin/kyc':           d.kyc_requests      || 0,
        '/admin/game-accounts': d.game_requests     || 0,
        '/admin/chat':          d.support_requests  || 0,
      })
    } catch (e) {
      console.error('Failed to load pending counts', e)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // Idle logout. When the casino turns on Session Timeout in Settings →
  // Security, a staff member with no mouse or keyboard activity for the set
  // number of minutes is signed out. The setting is per casino.
  useEffect(() => {
    if (!authorized) return
    let timer = null
    let listeners = []
    let cancelled = false

    async function signOutIdle() {
      await supabase.auth.signOut()
      router.push('/auth/login?reason=timeout')
    }

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/admin/settings/get', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (!res.ok) return
        const { settings } = await res.json()
        const val = k => settings.find(s => s.key === k)?.value
        const on = val('session_timeout_enabled') === 'true' || val('session_timeout_enabled') === true
        const mins = parseInt(val('session_timeout_minutes'), 10)
        if (cancelled || !on || !mins || mins < 1) return

        const reset = () => { if (timer) clearTimeout(timer); timer = setTimeout(signOutIdle, mins * 60 * 1000) }
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
        events.forEach(e => window.addEventListener(e, reset, { passive: true }))
        listeners = events.map(e => [e, reset])
        reset()
      } catch { /* leave the session alone if settings cannot be read */ }
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      listeners.forEach(([e, fn]) => window.removeEventListener(e, fn))
    }
  }, [authorized]) // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = (href) => href === '/admin' ? router.pathname === '/admin' : router.pathname.startsWith(href)
  const canSee   = (roles) => profile && roles.includes(profile.role)

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
      {show2fa && (
        <TwoFactorSetup
          forced={force2fa}
          onClose={() => { if (!force2fa) setShow2fa(false) }}
          onChange={() => { if (force2fa) { setForce2fa(false); setShow2fa(false) } }}
        />
      )}
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
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              Casinoze <span style={{ color: GOLD }}>Support</span>
            </div>
          </Link>
          <div className="admin-crumb" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.4)', marginLeft: 8, whiteSpace: 'nowrap' }}>
            <span style={{ margin: '0 8px 0 0', color: 'rgba(251,191,36,.4)' }}>›</span>
            <span style={{ color: '#fff' }}>{currentLabel}</span>
          </div>
        </div>

        {/* Centre — 6 quick-action tabs */}
        <div className="topbar-tabs" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center', maxWidth: 820, margin: '0 16px' }}>
          {TOPBAR_TABS.map(tab => {
            const count  = pendingCounts[tab.href] || 0
            const active = isActive(tab.href)
            return (
              <Link key={tab.href} href={tab.href}
                className={`tbtab${active ? ' active' : ''}`}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '11px 14px', borderRadius: 12, textDecoration: 'none',
                  fontSize: 13, fontWeight: 700, letterSpacing: '.01em',
                  background: active
                    ? `linear-gradient(135deg, ${tab.color}, ${tab.color}aa)`
                    : 'rgba(255,255,255,.04)',
                  border: `1px solid ${active ? tab.color : 'rgba(255,255,255,.09)'}`,
                  color: active ? '#050505' : 'rgba(255,255,255,.62)',
                  boxShadow: active ? `0 0 18px ${tab.color}55` : 'none',
                  whiteSpace: 'nowrap', transition: 'all .18s ease',
                }}>
                {tab.label}
                {count > 0 && (
                  <span style={{
                    background: active ? 'rgba(5,5,5,.82)' : tab.color,
                    color: active ? tab.color : '#050505',
                    fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 99,
                    minWidth: 18, textAlign: 'center', lineHeight: '14px', flexShrink: 0,
                  }}>
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
          {/* The role badge used to sit here and do nothing. It is a menu
              now: who you are, which casino this panel is for, and the way
              out. The casino's name matters most — staff who work across
              more than one need to know which panel they are looking at
              before they approve anything. */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(o => !o)} title="Your account"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 5px', background: menuOpen ? `${GOLD}1f` : 'rgba(255,255,255,.05)', border: `1px solid ${menuOpen ? GOLD + '88' : GOLD + '40'}`, borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s, border-color .15s' }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg,${GOLD},#f59e0b)`, color: '#050505', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(me?.full_name || me?.email || 'A').trim().charAt(0).toUpperCase()}
              </span>
              <span className="hide-sm" style={{ fontSize: 11, fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
                {me?.role?.replace('_', ' ') || 'admin'}
              </span>
            </button>

            {menuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 260, zIndex: 300, background: '#0b1626', border: '1px solid rgba(251,191,36,.25)', borderRadius: 14, boxShadow: '0 20px 48px rgba(0,0,0,.6)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', wordBreak: 'break-word' }}>{me?.full_name || '—'}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', wordBreak: 'break-all', marginTop: 2 }}>{me?.email || '—'}</div>
                  <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 9px', borderRadius: 99, background: `${GOLD}18`, border: `1px solid ${GOLD}44`, fontSize: 9.5, fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {me?.role?.replace('_', ' ') || 'admin'}
                  </div>
                </div>

                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Managing</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                    {me?.tenant_name || (me?.is_super_admin ? 'All casinos' : '—')}
                  </div>
                </div>

                <button onClick={() => { setMenuOpen(false); setShow2fa(true) }}
                  style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.07)', color: 'rgba(255,255,255,.75)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left' }}>
                  <Icon name="shield" size={15} /> Two-factor authentication
                </button>

                <button onClick={handleSignOut} disabled={signingOut}
                  style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: signingOut ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left' }}>
                  <Icon name="logout" size={15} /> {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{ position: 'fixed', top: 64, left: 0, bottom: 0, zIndex: 50, background: 'var(--panel-gradient,rgba(6,11,24,.98))', borderRight: '1px solid rgba(251,191,36,.1)', display: 'flex', flexDirection: 'column' }}>
        {/* No identity card here. Who you are signed in as is shown once, in
            the top bar. */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px', scrollbarWidth: 'none' }}>
          {NAV_SECTIONS.map(section => {
            const visibleItems = section.items.filter(item => canSee(item.roles))
            if (visibleItems.length === 0) return null
            return (
              <div key={section.label} style={{ marginBottom: 16 }}>
                <div className="rail-section" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(251,191,36,.7)', padding: '4px 12px 8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name={section.icon} size={14} />
                <span className="rail-label">{section.label}</span>
              </div>
                {visibleItems.map(item => {
                  const active  = isActive(item.href)
                  const pending = pendingCounts[item.href] || 0
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                      title={item.label}
                      className={`admin-nav${active ? ' active' : ''}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, marginBottom: 3, textDecoration: 'none', fontSize: 14, fontWeight: active ? 700 : 500, color: active ? '#050505' : 'rgba(255,255,255,.7)', background: active ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'transparent', boxShadow: active ? '0 0 20px rgba(251,191,36,.25)' : 'none' }}>
                      <Icon name={item.icon} />
                      <span className="rail-label" style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
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
          <button onClick={handleSignOut} disabled={signingOut} title="Sign out"
            className="rail-btn"
            style={{ width: '100%', height: 40, padding: '0 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 700, cursor: signingOut ? 'default' : 'pointer', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: signingOut ? .6 : 1, transition: 'background .15s, border-color .15s' }}>
            <Icon name="logout" size={16} />
            <span className="rail-label" style={{ whiteSpace: 'nowrap' }}>{signingOut ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, top: 64, background: 'rgba(0,0,0,.7)', zIndex: 40 }} />}

      <div className="admin-main" style={{ marginLeft: 72, paddingTop: 64, minHeight: '100vh' }}>
        <main className="admin-content" style={{ padding: '28px', maxWidth: 1400, margin: '0 auto', overflowX: 'hidden' }}>
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

        /* A hidden label must take no WIDTH either. With opacity alone the
           text still occupied the rail, so the Sign Out button centred its
           icon against invisible text and pushed it off the 72px edge. */
        .admin-sidebar .rail-label {
          opacity: 0;
          max-width: 0;
          overflow: hidden;
          transition: opacity .12s ease, max-width .18s ease;
          pointer-events: none;
        }
        .admin-sidebar:hover .rail-label,
        .admin-sidebar:focus-within .rail-label { opacity: 1; max-width: 190px; pointer-events: auto; }

        /* Collapsed, the sign-out button is a square icon button: no side
           padding and no gap, so the icon sits in the middle of the rail. */
        .admin-sidebar .rail-btn { gap: 0 !important; padding-left: 0 !important; padding-right: 0 !important; }
        .admin-sidebar:hover .rail-btn,
        .admin-sidebar:focus-within .rail-btn { gap: 8px !important; padding-left: 12px !important; padding-right: 12px !important; }

        /* The section heading keeps its height whether the rail is narrow or
           wide. It used to be height:0 collapsed and 22px expanded, so the
           moment the rail widened every row below a heading was pushed down
           and slid out from under the cursor — you hovered Deposits and
           ended up pointing at Withdrawals. Only the text fades now; the
           space it occupies never changes, so nothing moves. */
        .admin-sidebar .rail-section { height: 22px; padding: 4px 12px 8px !important; overflow: hidden; }
        /* While the rail is narrow the heading is just its icon, in the same
           gold as the text, so the row says Finance or Support instead of
           being an empty gap. */
        .admin-sidebar .rail-section svg { opacity: .75; }

        .admin-nav:not(.active):hover { background: rgba(251,191,36,.08) !important; color: #fff !important; }
        .admin-sidebar nav::-webkit-scrollbar { display: none; }
        .tbtab:not(.active):hover { background: rgba(255,255,255,.09) !important; color: #fff !important; border-color: rgba(255,255,255,.2) !important; }
        .tbtab.active:hover { filter: brightness(1.06); }
        @media (max-width: 1400px) { .topbar-tabs { max-width: 620px !important; } .tbtab { font-size: 12px !important; padding: 10px 8px !important; } }
        @media (max-width: 1100px) { .topbar-tabs { display: none !important; } }
        @media (max-width: 900px) { .admin-crumb { display: none; } }
        @media (max-width: 768px) {
          .admin-sidebar { width: 250px !important; transform: translateX(-100%); transition: transform .25s; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-sidebar .rail-label { opacity: 1 !important; max-width: none !important; pointer-events: auto !important; }
          .admin-sidebar .rail-btn { gap: 8px !important; padding-left: 12px !important; padding-right: 12px !important; }
          .admin-sidebar .rail-section { height: auto !important; padding: 4px 12px 8px !important; }
          .admin-main { margin-left: 0 !important; }
          .mobile-ham { display: flex !important; }
          .admin-content { padding: 16px 12px !important; }
          .hide-sm { display: none; }
        }
      `}</style>
    </div>
  )
}
