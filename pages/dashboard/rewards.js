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

// Default emoji per level name (admin can override via badge_icon)
const LEVEL_EMOJIS = {
  bronze:   '🥉',
  silver:   '🥈',
  gold:     '🥇',
  platinum: '💠',
  diamond:  '💎',
  elite:    '👑',
  master:   '🔥',
  champion: '⚡',
  legend:   '🏆',
}
function levelEmoji(level) {
  if (level.badge_icon) return level.badge_icon
  return LEVEL_EMOJIS[level.name?.toLowerCase()] || '⭐'
}

// ─── Level card ───────────────────────────────────────────────────────────────
// status: 'active' | 'achieved' | 'locked'
function LevelCard({ level, status, bonusRows }) {
  const accent = level.accent_color || level.badge_color || '#fbbf24'

  const badgeCfg = {
    active:   { label: 'Active',   bg: `${accent}25`,              border: `1px solid ${accent}66`,           color: accent,      },
    achieved: { label: 'Achieved', bg: 'rgba(16,185,129,.18)',      border: '1px solid rgba(16,185,129,.45)',   color: '#34d399',   },
    locked:   { label: 'Locked',   bg: 'rgba(255,255,255,.07)',     border: '1px solid rgba(255,255,255,.18)',  color: 'rgba(255,255,255,.5)', },
  }
  const badge = badgeCfg[status]

  const borderColor = status === 'active'
    ? accent
    : status === 'achieved'
      ? 'rgba(16,185,129,.35)'
      : 'rgba(255,255,255,.13)'

  const headerBg = status === 'active'
    ? `linear-gradient(135deg,${accent}18,transparent)`
    : status === 'achieved'
      ? 'linear-gradient(135deg,rgba(16,185,129,.08),transparent)'
      : 'transparent'

  return (
    <div style={{
      background: 'rgba(10,22,40,.7)',
      border: `1px solid ${borderColor}`,
      borderRadius: 18,
      boxShadow: status === 'active' ? `0 0 28px ${accent}30` : 'none',
      transition: 'box-shadow .2s',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        padding: '18px 20px 14px',
        background: headerBg,
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {/* Icon */}
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `${accent}22`,
            border: `2px solid ${status === 'locked' ? 'rgba(255,255,255,.2)' : accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            {levelEmoji(level)}
          </div>
          {/* Status badge */}
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 99,
            background: badge.bg, border: badge.border, color: badge.color,
          }}>{badge.label}</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: status === 'active' ? accent : '#fff', fontFamily: "'Cinzel',serif", letterSpacing: '.02em' }}>
          {level.name}
        </div>
        {level.description && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 3 }}>{level.description}</div>
        )}
      </div>

      {/* Redeem Rules */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', marginBottom: 14, textAlign: 'center' }}>
          Redeem Rules
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Wallet Rules sub-panel */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(96,165,250,.4)' }}>
            {/* Panel header */}
            <div style={{
              background: 'rgba(96,165,250,.18)',
              padding: '8px 12px',
              borderBottom: '1px solid rgba(96,165,250,.3)',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: '#93c5fd' }}>💰 Wallet Rules</span>
            </div>
            {/* Panel body */}
            <div style={{ background: 'rgba(96,165,250,.05)', padding: '10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <StatBox label="Min Withdraw"   value={fmt(level.min_withdrawal_cents)} />
              <StatBox label="Max Withdraw"   value={fmt(level.max_withdrawal_cents)} />
              <StatBox label="Limit Duration" value="24 Hours" color="rgba(255,255,255,.6)" />
            </div>
          </div>
          {/* Game Rules sub-panel */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(167,139,250,.4)' }}>
            {/* Panel header */}
            <div style={{
              background: 'rgba(167,139,250,.18)',
              padding: '8px 12px',
              borderBottom: '1px solid rgba(167,139,250,.3)',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: '#c4b5fd' }}>🎮 Game Rules</span>
            </div>
            {/* Panel body */}
            <div style={{ background: 'rgba(167,139,250,.05)', padding: '10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <StatBox label="Min Multiplier"   value={fmtX(level.min_redeem_multiplier)} />
              <StatBox label="Max Multiplier"   value={fmtX(level.max_redeem_multiplier)} />
              <StatBox label="Max Redeem Limit" value={fmt(level.max_redeem_cap_cents)} />
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Bonuses */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', marginBottom: 12, textAlign: 'center' }}>
          Deposit Bonuses
        </div>
        {bonusRows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', padding: '8px 0', textAlign: 'center' }}>No bonuses configured</div>
        ) : (
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 14px', background: 'rgba(255,255,255,.07)' }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)' }}>Payment Method</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)', textAlign: 'right' }}>Bonus %</span>
            </div>
            {bonusRows.map((b, i) => (
              <div key={b.pmId} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                padding: '10px 14px', alignItems: 'center',
                background: i % 2 === 0 ? 'rgba(255,255,255,.03)' : 'transparent',
                borderTop: '1px solid rgba(255,255,255,.06)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>{b.pmName}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>{parseFloat(b.bonus_percent).toFixed(0)}%</span>
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
  // Uses sort_order position to determine current level index
  const currentIdx   = levels.findIndex(l => l.id === profile?.player_level_id)
  const currentLevel = currentIdx >= 0 ? levels[currentIdx] : null
  const nextLevel    = currentIdx >= 0 ? levels[currentIdx + 1] : null

  let progressPct = 0
  if (profile && currentLevel && nextLevel) {
    const xp   = profile.total_xp || 0
    const from = currentLevel.xp_required || 0
    const to   = nextLevel.xp_required || 0
    // Guard: if xp thresholds are equal or bad, show 0%
    progressPct = (to > from)
      ? Math.min(100, Math.max(0, Math.round(((xp - from) / (to - from)) * 100)))
      : 0
  } else if (currentIdx > 0 && currentIdx === levels.length - 1) {
    // Truly at max level
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
          {levels.map((level, idx) => {
            // Status logic:
            // idx < currentIdx  → Achieved (completed, below current)
            // idx === currentIdx → Active   (player's current level)
            // idx > currentIdx  → Locked   (not yet reached)
            let status = 'locked'
            if (currentIdx >= 0) {
              if (idx < currentIdx)      status = 'achieved'
              else if (idx === currentIdx) status = 'active'
            }
            const bonusRows = bonusMap[level.id] || []
            return (
              <LevelCard
                key={level.id}
                level={level}
                status={status}
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
