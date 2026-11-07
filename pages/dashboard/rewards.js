/**
 * pages/dashboard/rewards.js  →  Player Levels
 * - Progress bar (% only, no XP shown)
 * - 3-col grid of level cards
 * - Each card: Rules (Wallet + Game) | Bonuses (today's day only)
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = c => c == null ? '—' : '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtX = v => v == null ? '—' : parseFloat(v).toFixed(1) + 'x'

// Platform week: Mon=1 … Sun=7
function todayDayNumber() {
  const d = new Date().getDay() // 0=Sun
  return d === 0 ? 7 : d
}

async function apiFetch(path) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Request failed') }
  return res.json()
}

// ─── Stat box ─────────────────────────────────────────────────────────────────
function StatBox({ label, value, color = 'rgba(255,255,255,.85)' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "'Outfit',sans-serif" }}>{value}</div>
    </div>
  )
}

// ─── Level card ───────────────────────────────────────────────────────────────
function LevelCard({ level, isCurrentLevel, reached, bonusRows }) {
  const accent = level.accent_color || level.badge_color || '#fbbf24'
  const locked = !reached

  return (
    <div style={{
      background: 'rgba(10,22,40,.7)',
      border: `1px solid ${isCurrentLevel ? accent : locked ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.12)'}`,
      borderRadius: 18,
      boxShadow: isCurrentLevel ? `0 0 28px ${accent}30` : 'none',
      opacity: locked ? 0.55 : 1,
      transition: 'box-shadow .2s',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        padding: '18px 20px 14px',
        background: isCurrentLevel
          ? `linear-gradient(135deg,${accent}18,transparent)`
          : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {/* Icon */}
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: locked ? 'rgba(255,255,255,.06)' : `${accent}22`,
            border: `2px solid ${locked ? 'rgba(255,255,255,.12)' : accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            {locked ? '🔒' : (level.badge_icon || '⭐')}
          </div>
          {/* Badge */}
          {isCurrentLevel && (
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
              padding: '3px 10px', borderRadius: 99,
              background: `${accent}25`, border: `1px solid ${accent}55`, color: accent,
            }}>Active</span>
          )}
          {locked && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Locked</span>
          )}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: isCurrentLevel ? accent : locked ? 'rgba(255,255,255,.4)' : '#fff', fontFamily: "'Cinzel',serif", letterSpacing: '.02em' }}>
          {level.name}
        </div>
        {level.description && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 3 }}>{level.description}</div>
        )}
      </div>

      {/* Rules */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Rules</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Wallet Rules */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#60a5fa', marginBottom: 8 }}>💰 Wallet</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <StatBox label="Min Withdraw"     value={fmt(level.min_withdrawal_cents)} />
              <StatBox label="Max Withdraw"     value={fmt(level.max_withdrawal_cents)} />
              <StatBox label="Limit Duration"   value="24 Hours" color="rgba(255,255,255,.5)" />
            </div>
          </div>
          {/* Game Rules */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 8 }}>🎮 Game</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <StatBox label="Min Multiplier"   value={fmtX(level.min_redeem_multiplier)} />
              <StatBox label="Max Multiplier"   value={fmtX(level.max_redeem_multiplier)} />
              <StatBox label="Max Redeem Limit" value={fmt(level.max_redeem_cap_cents)} />
            </div>
          </div>
        </div>
      </div>

      {/* Bonuses */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 10 }}>
          Deposit Bonuses — Today
        </div>
        {bonusRows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', padding: '8px 0' }}>No bonuses configured</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.07)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '7px 12px', background: 'rgba(255,255,255,.04)' }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>Payment Method</span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', textAlign: 'right' }}>Bonus %</span>
            </div>
            {bonusRows.map((b, i) => (
              <div key={b.pmId} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                padding: '9px 12px', alignItems: 'center',
                background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent',
                borderTop: '1px solid rgba(255,255,255,.04)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.75)' }}>{b.pmName}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>{parseFloat(b.bonus_percent).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PlayerLevels() {
  const [profile, setProfile]   = useState(null)
  const [levels, setLevels]     = useState([])
  const [bonusMap, setBonusMap] = useState({})   // { levelId: [{ pmId, pmName, bonus_percent }] }
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [
        { data: prof },
        { data: lvls },
      ] = await Promise.all([
        supabase.from('profiles').select('total_xp, player_level_id').eq('id', user.id).single(),
        supabase.from('player_levels').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ])

      setProfile(prof)
      setLevels(lvls || [])

      // Fetch today's bonuses from public API
      try {
        const today = todayDayNumber()
        const { data: bonuses } = await supabase
          .from('player_bonuses')
          .select('player_level_id, bonus_percent, payment_method_id, payment_methods(name)')
          .eq('day_number', today)
          .eq('is_active', true)
          .gt('bonus_percent', 0)

        const map = {}
        ;(bonuses || []).forEach(b => {
          if (!map[b.player_level_id]) map[b.player_level_id] = []
          map[b.player_level_id].push({ pmId: b.payment_method_id, pmName: b.payment_methods?.name || '—', bonus_percent: b.bonus_percent })
        })
        setBonusMap(map)
      } catch {}

      setLoading(false)
    }
    load()
  }, [])

  // Progress calculation
  const currentLevel = levels.find(l => l.id === profile?.player_level_id)
  const currentIdx   = levels.findIndex(l => l.id === profile?.player_level_id)
  const nextLevel    = levels[currentIdx + 1]

  let progressPct = 0
  if (profile && currentLevel && nextLevel) {
    const xp = profile.total_xp || 0
    const from = currentLevel.xp_required
    const to   = nextLevel.xp_required
    progressPct = Math.min(100, Math.max(0, Math.round(((xp - from) / (to - from)) * 100)))
  } else if (currentIdx === levels.length - 1 && levels.length > 0) {
    progressPct = 100
  }

  return (
    <PlayerLayout>
      <Head><title>Player Levels — Casinoze Room</title></Head>

      {/* Page heading */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Player Levels</h1>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, margin: 0 }}>
          Complete more activity to unlock higher tiers and bigger bonuses.
        </p>
      </div>

      {/* Progress bar */}
      {profile && levels.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 16, padding: '20px 24px', marginBottom: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: currentLevel?.accent_color || '#fbbf24' }}>
              {currentLevel?.name || 'Unranked'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {nextLevel && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>
                  Next: <span style={{ color: nextLevel.accent_color || '#fff', fontWeight: 700 }}>{nextLevel.name}</span>
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>{progressPct}%</span>
            </div>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${currentLevel?.accent_color || '#fbbf24'}, ${nextLevel?.accent_color || '#f59e0b'})`,
              borderRadius: 99,
              transition: 'width .6s ease',
              boxShadow: `0 0 10px ${currentLevel?.accent_color || '#fbbf24'}66`,
            }} />
          </div>
          {progressPct === 100 && (
            <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 8, fontWeight: 700 }}>🏆 Maximum level reached!</div>
          )}
        </div>
      )}

      {/* Levels grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,.3)', fontSize: 14 }}>Loading…</div>
      ) : levels.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Levels coming soon</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {levels.map(level => {
            const reached       = (profile?.total_xp || 0) >= level.xp_required
            const isCurrentLevel = level.id === profile?.player_level_id
            const bonusRows     = bonusMap[level.id] || []
            return (
              <LevelCard
                key={level.id}
                level={level}
                isCurrentLevel={isCurrentLevel}
                reached={reached}
                bonusRows={bonusRows}
              />
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .levels-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 580px) {
          .levels-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PlayerLayout>
  )
}
