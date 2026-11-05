import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { centsToDisplay } from '../ui/MoneyDisplay'
import Logo from '../ui/Logo'

// Edit this text to change the strip under the top bar. Set to '' to hide it.
const PROMO_TEXT = 'Welcome to Casinoze Room — add money, load a game and play.'

const GOLD = '#fbbf24'

// Minimal line icons (24x24, stroke only)
const ICONS = {
  home:     'M3 11l9-8 9 8M5 10v10h14V10',
  games:    'M6 12h4M8 10v4M15 13h.01M18 11h.01M7 7h10a4 4 0 014 4v2a4 4 0 01-4 4l-2-2H9l-2 2a4 4 0 01-4-4v-2a4 4 0 014-4z',
  cards:    'M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zM9 9h6M9 13h6',
  wallet:   'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h11M16 13.5h.01',
  plus:     'M12 5v14M5 12h14',
  list:     'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  trophy:   'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3',
  out:      'M7 17L17 7M9 7h8v8',
  star:     'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  users:    'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8',
  shield:   'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  chat:     'M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.7A8 8 0 1121 12z',
  user:     'M20 21v-1a6 6 0 00-6-6h-4a6 6 0 00-6 6v1M12 11a4 4 0 100-8 4 4 0 000 8z',
  bell:     'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0',
  logout:   'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  menu:     'M3 6h18M3 12h18M3 18h18',
}

function Icon({ name, size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={ICONS[name]} />
    </svg>
  )
}

const NAV_GROUPS = [
  { title: 'Main', items: [
    { href: '/dashboard',               icon: 'home',   label: 'Dashboard'    },
    { href: '/dashboard/games',         icon: 'games',  label: 'Games'        },
    { href: '/dashboard/game-accounts', icon: 'cards',  label: 'My Games'     },
    { href: '/dashboard/wallet',        icon: 'wallet', label: 'Wallet'       },
    { href: '/dashboard/deposit',       icon: 'plus',   label: 'Add Money'    },
    { href: '/dashboard/transactions',  icon: 'list',   label: 'Transactions' },
    { href: '/dashboard/redeem',        icon: 'trophy', label: 'Redeem'       },
    { href: '/dashboard/withdraw',      icon: 'out',    label: 'Withdraw'     },
  ]},
  { title: 'Account', items: [
    { href: '/dashboard/rewards',   icon: 'star',   label: 'Rewards & VIP' },
    { href: '/dashboard/referrals', icon: 'users',  label: 'Referrals'     },
    { href: '/dashboard/kyc',       icon: 'shield', label: 'Verification'  },
    { href: '/dashboard/profile',   icon: 'user',   label: 'Profile'       },
    { href: '/dashboard/support',   icon: 'chat',   label: 'Support'       },
  ]},
]

// Pill in the top bar: label on top, amount below
function BalanceChip({ label, cents, accent }) {
  return (
    <Link href="/dashboard/wallet" className="bal-chip" style={{
      textDecoration: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '5px 14px', borderRadius: 12, minWidth: 96,
      background: 'linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))',
      border: `1px solid ${accent}55`,
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', lineHeight: 1.2 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1.3 }}>{centsToDisplay(cents)}</span>
    </Link>
  )
}

// Live "recent wins" strip. Reads real rows from a `recent_wins` table/view
// (columns: id, masked_name, amount_cents, created_at). Renders nothing if there is no data.
function WinsTicker() {
  const [wins, setWins] = useState([])
  useEffect(() => {
    supabase.from('recent_wins').select('id, masked_name, amount_cents')
      .order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => { if (data?.length) setWins(data) })
      .catch(() => {})
  }, [])
  if (!wins.length) return null
  const row = [...wins, ...wins]
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(251,191,36,.12)', background: 'rgba(251,191,36,.03)', height: 34, display: 'flex', alignItems: 'center' }}>
      <div className="wins-track" style={{ display: 'inline-flex', gap: 40 }}>
        {row.map((w, i) => (
          <span key={i} style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>
            <span style={{ color: GOLD }}>🏆</span> {w.masked_name} <span style={{ opacity: .6 }}>WON</span> <span style={{ color: GOLD }}>{centsToDisplay(w.amount_cents)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Each player page renders its own PlayerLayout, so it is rebuilt on every click.
// This cache (lives until the tab is reloaded) keeps balances and the sidebar scroll from resetting.
const cache = { profile: null, wallet: null, unread: 0, navScroll: 0 }
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export default function PlayerLayout({ children }) {
  const router = useRouter()
  const [profile, setProfile] = useState(cache.profile)
  const [wallet, setWallet] = useState(cache.wallet)
  const [unread, setUnread] = useState(cache.unread)
  const navRef = useRef(null)

  useIsoLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    nav.scrollTop = cache.navScroll
    const el = nav.querySelector('.nav-link.active')
    if (el) {
      const n = nav.getBoundingClientRect(), e = el.getBoundingClientRect()
      if (e.top < n.top || e.bottom > n.bottom) nav.scrollTop += (e.top - n.top) - (n.height / 2 - e.height / 2)
    }
    cache.navScroll = nav.scrollTop
  }, [router.pathname])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [promoOpen, setPromoOpen] = useState(true)

  const loadUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const ref = localStorage.getItem('cz_ref')
      if (ref) { await supabase.rpc('apply_referral', { p_code: ref }); localStorage.removeItem('cz_ref') }
    } catch {}
    const [{ data: prof }, { data: wal }, { count }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      supabase.from('notifications').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('is_read', false),
    ])
    cache.profile = prof; cache.wallet = wal; cache.unread = count || 0
    setProfile(prof); setWallet(wal); setUnread(count || 0)
  }, [])

  useEffect(() => { loadUserData() }, [loadUserData])

  // keep balances fresh after every page change
  useEffect(() => {
    router.events.on('routeChangeComplete', loadUserData)
    return () => router.events.off('routeChangeComplete', loadUserData)
  }, [router.events, loadUserData])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    cache.profile = null; cache.wallet = null; cache.unread = 0; cache.navScroll = 0
    window.location.href = '/'   // full reload to the home page so no old session state lingers
  }

  const isActive = (href) =>
    href === '/dashboard' ? router.pathname === '/dashboard' : router.pathname.startsWith(href)

  const showPromo = PROMO_TEXT && promoOpen

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', backgroundAttachment: 'fixed', fontFamily: "'Outfit', sans-serif", color: '#fff' }}>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      {/* ── TOP BAR ── */}
      <header className="top-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 20px', maxWidth: '100vw',
        background: 'var(--panel-gradient)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(251,191,36,.18)',
        boxShadow: '0 4px 24px rgba(0,0,0,.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSidebarOpen(p => !p)} className="mobile-hamburger" aria-label="Menu"
            style={{ display: 'none', background: 'none', border: 'none', color: GOLD, cursor: 'pointer', padding: 4 }}>
            <Icon name="menu" size={24} />
          </button>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="logo-full"><Logo variant="full" height={54} /></span><span className="logo-icon"><Logo variant="icon" height={50} /></span>
          </Link>
        </div>

        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/dashboard/deposit" className="deposit-btn" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: 12,
            color: '#050505', fontSize: 12, fontWeight: 800, textDecoration: 'none', letterSpacing: '.06em',
            textTransform: 'uppercase', boxShadow: '0 0 18px rgba(251,191,36,.3)',
          }}>
            <Icon name="plus" size={14} /> Deposit
          </Link>
          <BalanceChip label="Cash Balance"  cents={wallet?.cash_balance_cents  || 0} accent="#10b981" />
          <BalanceChip label="Bonus Balance" cents={wallet?.bonus_balance_cents || 0} accent={GOLD} />
          <Link href="/dashboard/notifications" style={{ position: 'relative', color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
            <Icon name="bell" size={18} />
            {unread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: GOLD, color: '#000', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 99 }}>{unread}</span>}
          </Link>
          <Link href="/dashboard/profile" className="avatar-btn" style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#fbbf24,#b45309)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#050505', textDecoration: 'none', border: '2px solid rgba(251,191,36,.5)' }}>
            {(profile?.full_name || 'U')[0].toUpperCase()}
          </Link>
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <aside className={`player-sidebar${sidebarOpen ? ' open' : ''}`} style={{
        position: 'fixed', top: 64, left: 0, bottom: 0, width: 250, zIndex: 50,
        background: 'var(--panel-gradient)',
        borderRight: '1px solid rgba(251,191,36,.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <nav ref={navRef} onScroll={e => { cache.navScroll = e.currentTarget.scrollTop }} style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', scrollbarWidth: 'none' }}>
          {NAV_GROUPS.map(group => (
            <div key={group.title} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(251,191,36,.7)', padding: '4px 12px 8px' }}>{group.title}</div>
              {group.items.map(item => {
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                    className={`nav-link${active ? ' active' : ''}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 12, marginBottom: 3,
                      textDecoration: 'none', fontSize: 14, fontWeight: active ? 700 : 500,
                      color: active ? '#050505' : 'rgba(255,255,255,.7)',
                      background: active ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : 'transparent',
                      boxShadow: active ? '0 0 20px rgba(251,191,36,.25)' : 'none',
                    }}>
                    <Icon name={item.icon} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid rgba(251,191,36,.1)' }}>
          {profile && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 12, background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.12)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.full_name}</div>
              <div style={{ fontSize: 10, color: GOLD, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>Level {profile.player_level_id || 1}</div>
            </div>
          )}
          <button onClick={handleSignOut} disabled={signingOut} style={{ width: '100%', padding: '10px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="logout" size={16} /> {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, top: 64, background: 'rgba(0,0,0,.7)', zIndex: 40 }} />}

      {/* ── MAIN ── */}
      <div className="player-main" style={{ marginLeft: 250, paddingTop: 64, minHeight: '100vh' }}>
        <WinsTicker />
        {showPromo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '10px 40px 10px 16px', position: 'relative', background: 'linear-gradient(90deg,rgba(251,191,36,.14),rgba(245,158,11,.06),rgba(251,191,36,.14))', borderBottom: '1px solid rgba(251,191,36,.18)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
            <span style={{ color: GOLD }}>🎁</span> {PROMO_TEXT}
            <button onClick={() => setPromoOpen(false)} aria-label="Dismiss" style={{ position: 'absolute', right: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
        )}
        <main className="player-content" style={{ padding: '28px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        .nav-link:not(.active):hover { background: rgba(251,191,36,.08) !important; color: #fff !important; }
        .player-sidebar::-webkit-scrollbar { display: none; }
        .wins-track { animation: winsScroll 40s linear infinite; padding-left: 20px; }
        @keyframes winsScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .logo-icon { display: none; }
        .bal-chip:hover { border-color: rgba(251,191,36,.6) !important; }
        @media (max-width: 900px) {
          .logo-full { display: none; }
          .logo-icon { display: inline-flex !important; }
          .deposit-btn { padding: 9px 12px !important; }
        }
        @media (max-width: 768px) {
          .player-sidebar { transform: translateX(-100%); transition: transform .25s; }
          .player-sidebar.open { transform: translateX(0); }
          .player-main { margin-left: 0 !important; overflow-x: hidden; }
          .player-content { padding: 18px 14px !important; }
          .top-header { padding: 0 12px !important; gap: 8px !important; }
          .header-right { gap: 8px !important; }
          .logo-icon .logo-mark { height: 42px !important; width: 42px !important; }
          .mobile-hamburger { display: flex !important; }
          .avatar-btn { display: none !important; }
          .bal-chip { min-width: 0 !important; padding: 4px 8px !important; }
        }
        @media (max-width: 480px) {
          .deposit-btn { display: none !important; }
          .header-right { gap: 6px !important; }
          .bal-chip { padding: 3px 7px !important; }
          .bal-chip span:last-child { font-size: 12.5px !important; }
          .bal-chip span:first-child { font-size: 8px !important; letter-spacing: .06em !important; }
          .player-content { padding: 14px 12px !important; }
        }
      `}</style>
    </div>
  )
}
