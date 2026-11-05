import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import StatusBadge from '../../components/ui/StatusBadge'

function AccountCard({ account }) {
  const [showPassword, setShowPassword] = useState(false)
  const [hov, setHov] = useState(false)
  const color = account.game_panels?.accent_color || '#fbbf24'

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied!`)
    })
  }

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      borderRadius: 18, overflow: 'hidden',
      background: 'rgba(255,255,255,.03)',
      border: `1.5px solid ${hov ? color + '55' : 'rgba(255,255,255,.08)'}`,
      transition: 'all .2s',
    }}>
      {/* Color bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg,${color},${color}66)` }} />

      <div style={{ padding: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎮</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'Cinzel',serif" }}>{account.game_panels?.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{account.reference_id}</div>
            </div>
          </div>
          <StatusBadge status={account.status} />
        </div>

        {/* Credentials */}
        {account.status === 'active' && account.game_username ? (
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            {/* Username */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Username</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '.05em' }}>{account.game_username}</div>
              </div>
              <button onClick={() => copyToClipboard(account.game_username, 'Username')}
                style={{ padding: '6px 12px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: '#fbbf24', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                📋 Copy
              </button>
            </div>

            {/* Password */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Password</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '.05em' }}>
                  {showPassword ? (account.game_password_display || '••••••••') : '••••••••'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowPassword(p => !p)}
                  style={{ padding: '6px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                  {showPassword ? '🙈 Hide' : '👁 Show'}
                </button>
                {showPassword && (
                  <button onClick={() => copyToClipboard(account.game_password_display || '', 'Password')}
                    style={{ padding: '6px 12px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: '#fbbf24', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    📋 Copy
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : account.status === 'pending' ? (
          <div style={{ padding: '16px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 12, marginBottom: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>Being Set Up</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 4 }}>Our team is creating your account. You'll be notified once it's ready.</div>
          </div>
        ) : null}

        {/* Game ID */}
        {account.game_id && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>Game ID</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{account.game_id}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {account.status === 'active' && (
            <Link href={`/dashboard/load-game?account=${account.id}`} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 800, textDecoration: 'none', textAlign: 'center', letterSpacing: '.02em' }}>
              ➕ Load Credits
            </Link>
          )}
          <Link href="/dashboard/support" style={{ flex: account.status === 'active' ? 0 : 1, padding: '10px 14px', background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 10, color: '#fbbf24', fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
            💬 Support
          </Link>
        </div>
      </div>

      {/* Created date */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,.04)', fontSize: 10, color: 'rgba(255,255,255,.2)', fontWeight: 600 }}>
        Requested {new Date(account.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  )
}

export default function GameAccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAccounts() }, [])

  async function loadAccounts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data } = await supabase
      .from('game_accounts')
      .select('*, game_panels(name, accent_color, slug, redeem_multiplier)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setAccounts(data || [])
    setLoading(false)
  }

  if (loading) return (
    <PlayerLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading your game accounts…</div>
      </div>
    </PlayerLayout>
  )

  return (
    <PlayerLayout>
      <Head><title>My Game Accounts — Casinoze Room</title></Head>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, color: '#fff', marginBottom: 4 }}>My Game Accounts</h1>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>View your credentials and manage your game room accounts.</p>
      </div>

      {accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🎮</div>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 12 }}>No Game Accounts Yet</h2>
          <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 15, marginBottom: 28 }}>Request a game account to start playing. Our team will set it up for you.</p>
          <Link href="/dashboard/games" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: 14, color: '#050505', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
            🎮 Browse Games
          </Link>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Total',     value: accounts.length,                                         color: '#fbbf24' },
              { label: 'Active',    value: accounts.filter(a => a.status === 'active').length,      color: '#10b981' },
              { label: 'Pending',   value: accounts.filter(a => a.status === 'pending').length,     color: '#f59e0b' },
              { label: 'Suspended', value: accounts.filter(a => a.status === 'suspended').length,   color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px 18px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px,100%),1fr))', gap: 16, marginBottom: 24 }}>
            {accounts.map(account => <AccountCard key={account.id} account={account} />)}
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link href="/dashboard/games" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 12, color: '#fbbf24', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              + Request Another Game Account
            </Link>
          </div>
        </>
      )}
    </PlayerLayout>
  )
}
