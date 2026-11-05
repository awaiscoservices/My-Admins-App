import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import StatusBadge from '../../components/ui/StatusBadge'

function GameCard({ game, myAccount, onRequest, requesting }) {
  const [hov, setHov] = useState(false)
  const color = game.accent_color || '#fbbf24'

  const btnLabel = () => {
    if (!myAccount) return requesting ? '⏳ Requesting…' : '+ Create Account'
    if (myAccount.status === 'pending') return '⏳ Pending Setup'
    if (myAccount.status === 'active') return '✓ Account Active'
    if (myAccount.status === 'suspended') return '⚠ Suspended'
    return 'View Account'
  }

  const btnDisabled = !!myAccount || requesting

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      borderRadius: 20, overflow: 'hidden',
      background: hov ? `linear-gradient(135deg,${color}18,rgba(0,0,0,.4))` : 'rgba(255,255,255,.03)',
      border: `1.5px solid ${hov ? color + '66' : 'rgba(255,255,255,.08)'}`,
      transition: 'all .25s',
      transform: hov ? 'translateY(-4px)' : 'none',
      boxShadow: hov ? `0 20px 50px rgba(0,0,0,.5), 0 0 30px ${color}22` : 'none',
    }}>
      {/* Header bar */}
      <div style={{ height: 6, background: `linear-gradient(90deg,${color},${color}66)` }} />

      <div style={{ padding: '20px' }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {game.is_hot && <span style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 99, letterSpacing: '.06em' }}>🔥 HOT</span>}
          <span style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 99, letterSpacing: '.06em' }}>
            {game.default_bonus_pct}% BONUS
          </span>
        </div>

        {/* Game icon area */}
        <div style={{ width: 64, height: 64, borderRadius: 16, background: `linear-gradient(135deg,${color}22,${color}08)`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14, boxShadow: hov ? `0 0 20px ${color}33` : 'none', transition: 'box-shadow .25s' }}>
          🎮
        </div>

        {/* Name + description */}
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6, fontFamily: "'Cinzel', serif" }}>{game.name}</div>
        {game.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.6, marginBottom: 14 }}>{game.description}</div>}

        {/* Rules */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {game.min_load_cents && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', background: 'rgba(255,255,255,.05)', padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}>
              Min Load: ${(game.min_load_cents / 100).toFixed(0)}
            </div>
          )}
          {game.redeem_multiplier && (
            <div style={{ fontSize: 10, color: color, background: `${color}15`, padding: '4px 10px', borderRadius: 8, fontWeight: 700 }}>
              {game.redeem_multiplier}× Multiplier
            </div>
          )}
        </div>

        {/* Account status if exists */}
        {myAccount && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,.04)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>
              {myAccount.game_username ? `@${myAccount.game_username}` : 'Setting up…'}
            </span>
            <StatusBadge status={myAccount.status} size="xs" />
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={() => !btnDisabled && onRequest(game)}
          disabled={btnDisabled}
          style={{
            width: '100%', padding: '11px', borderRadius: 12,
            background: myAccount?.status === 'active'
              ? 'rgba(16,185,129,.12)'
              : btnDisabled
                ? 'rgba(255,255,255,.05)'
                : `linear-gradient(135deg,${color},${color}cc)`,
            border: `1px solid ${myAccount?.status === 'active' ? 'rgba(16,185,129,.3)' : btnDisabled ? 'rgba(255,255,255,.08)' : color + '66'}`,
            color: btnDisabled && myAccount?.status !== 'active' ? 'rgba(255,255,255,.35)' : myAccount?.status === 'active' ? '#10b981' : '#fff',
            fontSize: 13, fontWeight: 800, cursor: btnDisabled ? 'not-allowed' : 'pointer',
            fontFamily: "'Outfit',sans-serif", letterSpacing: '.02em', transition: 'all .2s',
          }}
        >
          {btnLabel()}
        </button>
      </div>
    </div>
  )
}

export default function GamesPage() {
  const router = useRouter()
  const [games, setGames] = useState([])
  const [myAccounts, setMyAccounts] = useState({}) // { game_panel_id: account }
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(null) // game_panel_id being requested
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { loadData() }, [])

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const [{ data: gamesData }, { data: accountsData }] = await Promise.all([
      supabase.from('game_panels').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('game_accounts').select('*').eq('user_id', user.id),
    ])

    setGames(gamesData || [])

    // Map accounts by game_panel_id for quick lookup
    const accountMap = {}
    ;(accountsData || []).forEach(a => { accountMap[a.game_panel_id] = a })
    setMyAccounts(accountMap)
    setLoading(false)
  }

  async function handleRequest(game) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    setRequesting(game.id)
    try {
      const res = await fetch('/api/game-accounts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ game_panel_id: game.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')

      showToast(`${game.name} account requested! Our team will set it up shortly.`, 'success')
      loadData() // refresh
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error')
    } finally {
      setRequesting(null)
    }
  }

  const filteredGames = games.filter(g => {
    if (filter === 'hot') return g.is_hot
    if (filter === 'mine') return !!myAccounts[g.id]
    return true
  })

  if (loading) return (
    <PlayerLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading games…</div>
      </div>
    </PlayerLayout>
  )

  return (
    <PlayerLayout>
      <Head><title>Games — Casinoze Room</title></Head>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'error' ? 'rgba(239,68,68,.95)' : toast.type === 'success' ? 'rgba(16,185,129,.95)' : 'rgba(251,191,36,.95)', borderRadius: 12, padding: '12px 24px', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, color: '#fff', marginBottom: 4 }}>Game Rooms</h1>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Request an account in any game room. Our team will set it up for you.</p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Games',   value: games.length,                         color: '#fbbf24' },
          { label: 'My Accounts',  value: Object.keys(myAccounts).length,        color: '#10b981' },
          { label: 'Active',       value: Object.values(myAccounts).filter(a => a.status === 'active').length, color: '#f59e0b' },
          { label: 'Pending',      value: Object.values(myAccounts).filter(a => a.status === 'pending').length, color: '#94a3b8' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 20px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', padding: 4, borderRadius: 12, width: 'fit-content', marginBottom: 24 }}>
        {[['all','All Games'],['hot','🔥 Hot'],['mine','My Accounts']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700, background: filter === key ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : 'transparent', color: filter === key ? '#fff' : 'rgba(255,255,255,.45)', transition: 'all .2s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Games grid */}
      {filteredGames.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
            {filter === 'mine' ? 'No game accounts yet' : 'No games found'}
          </div>
          {filter === 'mine' && (
            <button onClick={() => setFilter('all')} style={{ marginTop: 12, padding: '10px 24px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, color: '#fbbf24', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              Browse Games
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px,46%),1fr))', gap: 16 }}>
          {filteredGames.map(game => (
            <GameCard
              key={game.id}
              game={game}
              myAccount={myAccounts[game.id]}
              onRequest={handleRequest}
              requesting={requesting === game.id}
            />
          ))}
        </div>
      )}
    </PlayerLayout>
  )
}
