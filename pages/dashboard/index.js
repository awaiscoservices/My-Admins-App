import { useEffect, useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import MoneyDisplay from '../../components/ui/MoneyDisplay'
import StatusBadge from '../../components/ui/StatusBadge'
import { getMyTransactions, getMyPendingCounts, getMyGameAccounts, txTypeLabel, txTypeColor } from '../../lib/wallet'
import { gameLogoFor } from '../../lib/gameCatalog'

// ─── WHEEL OF FORTUNE ─────────────────────────────────────────────────────────
const SEGMENTS = [
  { label: '0.2×', multiplier: 0.2, color: '#1e3a5f' },
  { label: '4×',   multiplier: 4,   color: '#7c2d12' },
  { label: '0.4×', multiplier: 0.4, color: '#14532d' },
  { label: '1.8×', multiplier: 1.8, color: '#4c1d95' },
  { label: '0.6×', multiplier: 0.6, color: '#1e3a5f' },
  { label: '3×',   multiplier: 3,   color: '#7c2d12' },
  { label: '1×',   multiplier: 1,   color: '#14532d' },
  { label: '2.6×', multiplier: 2.6, color: '#4c1d95' },
  { label: '1.2×', multiplier: 1.2, color: '#1e3a5f' },
  { label: '1.6×', multiplier: 1.6, color: '#7c2d12' },
]
const SEG_ANGLE = (Math.PI * 2) / SEGMENTS.length

// ─── LOOK & FEEL (design only) ────────────────────────────────────────────────
const PANEL = { background: 'linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018))', border: '1px solid rgba(251,191,36,.13)', boxShadow: '0 14px 36px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.05)' }
const LABEL = { fontSize: 11, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(251,191,36,.78)' }
const TILE_TINTS = [['#1f9d7a', '#0f3b4a'], ['#2b5fd9', '#13264f'], ['#7a3fe0', '#2a1450'], ['#12b8d6', '#0c3350'], ['#2b6fe0', '#14285a'], ['#1fa77f', '#0c3a3f']]
const I_PATHS = {
  plus: 'M12 5v14M5 12h14', gamepad: 'M6 12h4M8 10v4M15 13h.01M18 11h.01M7 7h10a4 4 0 014 4v2a4 4 0 01-4 4l-2-2H9l-2 2a4 4 0 01-4-4v-2a4 4 0 014-4z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3', out: 'M7 17L17 7M9 7h8v8',
  wallet: 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h11M16 13.5h.01', gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H8.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h3.5a2.5 2.5 0 100-5C13 2 12 7 12 7z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3', arrow: 'M5 12h14M13 6l6 6-6 6', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', spin: 'M21 12a9 9 0 11-3-6.7M21 4v5h-5',
}
function I({ name, size = 18, stroke = 1.8 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"><path d={I_PATHS[name] || I_PATHS.list} /></svg>
}

// Colours of the wheel. (To make it gold instead of teal, change `accent`, `ring`, `hub` and `glow`.)
const TWO_PI = Math.PI * 2
const WHEEL = {
  accent: '#5eead4', glow: 'rgba(45,212,191,',
  ring: ['#1d5f6b', '#0d3342', '#17707a'],
  dial: ['#3b4644', '#0a2a32'],
  hub: ['#6fc4bd', '#24777e', '#0c373d'],
}
const ICO = {
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3',
  gem: 'M6 3h12l4 6-10 12L2 9l4-6zM2 9h20M9 3l3 6 3-6M12 21L9 9M12 21l3-12',
  coin: 'M12 21a9 9 0 100-18 9 9 0 000 18zM14.5 9.5c-.5-1-1.4-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H8.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h3.5a2.5 2.5 0 100-5C13 2 12 7 12 7z',
  bag: 'M9 3h6l-1.2 3h-3.6L9 3zM8.6 6C5.2 9 4 12 4 15a5 5 0 005 5h6a5 5 0 005-5c0-3-1.2-6-4.6-9M12 11v7M14 12.6c-.4-.8-1.1-1.1-2-1.1s-1.8.5-1.8 1.4 1 1.3 1.8 1.5 1.8.6 1.8 1.5-.9 1.4-1.8 1.4-1.7-.4-2-1.2',
}
const SEG_ICON = [['trophy', '#f5c451'], ['gem', '#f59e42'], ['coin', '#a78bfa'], ['gift', '#2dd4bf'], ['bag', '#f59e42'], ['gem', '#22d3ee'], ['coin', '#4ade80'], ['bag', '#a78bfa'], ['gift', '#2dd4bf'], ['coin', '#fbbf24']]
const polar = (R, th) => [200 + R * Math.sin(th), 200 - R * Math.cos(th)]
const WEDGE = (() => {
  const w = SEG_ANGLE * 0.84, Ro = 152, Ri = 57
  const [x1, y1] = polar(Ro, -w / 2), [x2, y2] = polar(Ro, w / 2), [x3, y3] = polar(Ri, w / 2), [x4, y4] = polar(Ri, -w / 2)
  return `M${x1} ${y1}A${Ro} ${Ro} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${Ri} ${Ri} 0 0 0 ${x4} ${y4}Z`
})()

function SpinnerWheel({ spinning, finalAngle, onDone, onSpin, disabled }) {
  const gRef = useRef(null)
  const pRef = useRef(null)
  const rafRef = useRef(0)
  const rotRef = useRef(0)
  const [winIdx, setWinIdx] = useState(-1)
  const N = SEGMENTS.length

  const setRot = (a) => { if (gRef.current) gRef.current.setAttribute('transform', `rotate(${(a * 180) / Math.PI} 200 200)`) }
  const setPtr = (d) => { if (pRef.current) pRef.current.setAttribute('transform', `rotate(${d} 200 8)`) }

  useEffect(() => {
    if (!spinning) return
    setWinIdx(-1)
    const cur = rotRef.current
    // end exactly on `finalAngle`, after at least 8 full turns (so the wheel always matches the result shown)
    const target = cur + TWO_PI * 8 + ((((finalAngle - cur) % TWO_PI) + TWO_PI) % TWO_PI)
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DURATION = reduce ? 250 : 4400
    let start = null, lastSeg = Math.floor(cur / SEG_ANGLE), kick = 0

    const finish = () => {
      rotRef.current = target; setRot(target); setPtr(0)
      setWinIdx(((Math.round(-finalAngle / SEG_ANGLE - 0.5) % N) + N) % N)
      onDone && onDone()
    }
    function frame(ts) {
      if (start === null) start = ts
      const t = Math.min((ts - start) / DURATION, 1)
      const a = cur + (target - cur) * (1 - Math.pow(1 - t, 4))   // smooth slow-down
      setRot(a)
      const seg = Math.floor(a / SEG_ANGLE)
      if (seg !== lastSeg) { kick = -16; lastSeg = seg }           // pointer flicks as each wedge passes
      kick *= 0.84; setPtr(kick)
      if (t < 1) rafRef.current = requestAnimationFrame(frame); else finish()
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [spinning, finalAngle, onDone])

  const canSpin = !spinning && !disabled && !!onSpin
  const press = () => { if (canSpin) onSpin() }

  return (
    <div className="fw" style={{ position: 'relative', width: 'min(380px, 84vw)', margin: '0 auto' }}>
      <svg viewBox="0 -24 400 426" width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Wheel of Fortune">
        <defs>
          <linearGradient id="fwRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={WHEEL.ring[0]} /><stop offset=".5" stopColor={WHEEL.ring[1]} /><stop offset="1" stopColor={WHEEL.ring[2]} /></linearGradient>
          <radialGradient id="fwDial" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor={WHEEL.dial[0]} /><stop offset="1" stopColor={WHEEL.dial[1]} /></radialGradient>
          <linearGradient id="fwWedge" gradientUnits="userSpaceOnUse" x1="0" y1="48" x2="0" y2="144"><stop offset="0" stopColor="#12474f" /><stop offset="1" stopColor="#06202a" /></linearGradient>
          <linearGradient id="fwWin" gradientUnits="userSpaceOnUse" x1="0" y1="48" x2="0" y2="144"><stop offset="0" stopColor="#2dd4bf" /><stop offset="1" stopColor="#0f6f78" /></linearGradient>
          <radialGradient id="fwHub" cx="50%" cy="30%" r="80%"><stop offset="0" stopColor={WHEEL.hub[0]} /><stop offset=".55" stopColor={WHEEL.hub[1]} /><stop offset="1" stopColor={WHEEL.hub[2]} /></radialGradient>
          <linearGradient id="fwPtr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fd6cf" /><stop offset="1" stopColor="#2a8088" /></linearGradient>
        </defs>

        {/* ring */}
        <circle cx="200" cy="200" r="196" fill="url(#fwRing)" />
        <circle cx="200" cy="200" r="195" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="168" fill="none" stroke="rgba(94,234,212,.28)" strokeWidth="1.5" />
        {Array.from({ length: 28 }, (_, i) => { const [x, y] = polar(180, (i / 28) * TWO_PI); return <circle key={i} className={`fw-l${spinning ? ' fast' : ''}`} cx={x} cy={y} r="2.7" style={{ '--i': i }} /> })}
        <circle cx="200" cy="200" r="163" fill="#06202a" stroke="rgba(94,234,212,.22)" strokeWidth="2" />
        <circle cx="200" cy="200" r="158" fill="url(#fwDial)" />

        {/* spinning part */}
        <g ref={gRef} transform="rotate(0 200 200)">
          {SEGMENTS.map((seg, i) => {
            const [ic, col] = SEG_ICON[i % SEG_ICON.length]
            const win = winIdx === i
            return (
              <g key={i} transform={`rotate(${((i + 0.5) * SEG_ANGLE * 180) / Math.PI} 200 200)`}>
                <path d={WEDGE} className={win ? 'fw-win' : ''} fill={win ? 'url(#fwWin)' : 'url(#fwWedge)'} stroke={win ? 'rgba(255,255,255,.6)' : 'rgba(94,234,212,.24)'} strokeWidth="1.3" strokeLinejoin="round" />
                <g transform="translate(187 66) scale(1.08)" fill="none" stroke={col} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICO[ic]} /></g>
                <text x="200" y="113" textAnchor="middle" className="fw-t">{seg.label}</text>
              </g>
            )
          })}
        </g>

        {/* centre button */}
        <g className={`fw-hub${canSpin ? ' on' : ''}`} onClick={press} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press() } }} role="button" tabIndex={canSpin ? 0 : -1} aria-label="Spin the wheel" aria-disabled={!canSpin}>
          <circle cx="200" cy="200" r="60" fill="#06222a" />
          <circle className="fw-hubc" cx="200" cy="200" r="53" fill="url(#fwHub)" stroke="rgba(255,255,255,.28)" strokeWidth="2.5" />
          <ellipse cx="200" cy="178" rx="34" ry="15" fill="rgba(255,255,255,.14)" />
          <text x="200" y="205" textAnchor="middle" className="fw-hubt">{spinning ? 'Please Stay' : 'Spin Now!'}</text>
        </g>

        {/* pointer */}
        <g ref={pRef} transform="rotate(0 200 8)">
          <path d="M191 22L200 66L209 22Z" fill="url(#fwPtr)" />
          <circle cx="200" cy="8" r="23" fill="url(#fwPtr)" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
          <circle cx="200" cy="8" r="11.5" fill="#0b2f37" stroke="rgba(94,234,212,.55)" strokeWidth="1.5" />
        </g>
      </svg>
      <style>{`
        .fw svg{filter:drop-shadow(0 0 24px ${WHEEL.glow}.30));animation:fwGlow 3.2s ease-in-out infinite alternate}
        @keyframes fwGlow{from{filter:drop-shadow(0 0 16px ${WHEEL.glow}.20))}to{filter:drop-shadow(0 0 36px ${WHEEL.glow}.46))}}
        .fw-l{fill:${WHEEL.accent};opacity:.3;animation:fwBlink 2.6s ease-in-out infinite;animation-delay:calc(var(--i)*-.093s)}
        .fw-l.fast{animation-duration:.5s;animation-delay:calc(var(--i)*-.018s)}
        @keyframes fwBlink{0%,100%{opacity:.22}50%{opacity:1}}
        .fw-t{fill:#fff;font:800 15px Outfit,sans-serif;letter-spacing:.04em;paint-order:stroke;stroke:rgba(0,0,0,.4);stroke-width:2.4px;stroke-linejoin:round}
        .fw-win{animation:fwWin .8s ease-in-out infinite alternate}
        @keyframes fwWin{from{filter:brightness(1)}to{filter:brightness(1.55)}}
        .fw-hubt{fill:#fff;font:800 15px Outfit,sans-serif;paint-order:stroke;stroke:rgba(0,0,0,.35);stroke-width:2px}
        .fw-hub{outline:none}.fw-hub.on{cursor:pointer}
        .fw-hub.on:hover .fw-hubc{filter:brightness(1.18)}.fw-hub.on:focus-visible .fw-hubc{stroke:#fff}
        @media(prefers-reduced-motion:reduce){.fw svg,.fw-l,.fw-win{animation:none}}
      `}</style>
    </div>
  )
}

function WheelSection({ wallet }) {
  const [betCents, setBetCents]     = useState(500)   // $5
  const [bucket, setBucket]         = useState('cash')
  const [spinning, setSpinning]     = useState(false)
  const [finalAngle, setFinalAngle] = useState(0)
  const [result, setResult]         = useState(null)   // { seg, winCents }
  const [history, setHistory]       = useState([])
  const [err, setErr]               = useState('')
  const [freeInfo, setFreeInfo]     = useState(false)
  const doneRef = useRef(false)

  const balance = wallet ? (bucket === 'cash' ? wallet.cash_balance_cents : wallet.bonus_balance_cents) : 0

  function changeBet(delta) {
    setBetCents(prev => Math.max(100, Math.min(prev + delta * 100, 100000)))
  }

  async function spin() {
    if (spinning) return
    if (betCents > balance) { setErr('Insufficient balance'); return }
    setErr('')
    doneRef.current = false

    // Pick random segment
    const idx = Math.floor(Math.random() * SEGMENTS.length)
    const seg = SEGMENTS[idx]
    // Angle so pointer lands on this segment (pointer at top = -PI/2)
    const targetAngle = -(idx * SEG_ANGLE + SEG_ANGLE / 2)
    setFinalAngle(targetAngle)
    setResult(null)
    setSpinning(true)

    // Simulate deduct + win server-side would go here
    // For now calculate client-side as demo
    const winCents = Math.round(betCents * seg.multiplier)
    doneRef.current = { seg, winCents }
  }

  const handleSpinDone = useCallback(() => {
    if (!doneRef.current) return
    const { seg, winCents } = doneRef.current
    setSpinning(false)
    setResult({ seg, winCents })
    setHistory(h => [{ id: Date.now(), label: seg.label, win: winCents, ts: new Date() }, ...h].slice(0, 10))
  }, [])

  const hasDeposit = wallet && (wallet.cash_balance_cents > 0 || wallet.bonus_balance_cents > 0)
  const maxMult = Math.max(...SEGMENTS.map(x => x.multiplier))
  const won = result && result.seg.multiplier >= 1
  const smallLabel = { fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 8 }
  const stepBtn = { width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)', color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'background .2s,border-color .2s' }

  return (
    <div style={{ ...PANEL, borderRadius: 26, padding: 'clamp(18px,3vw,32px)', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: '-8%', top: '-25%', width: '58%', height: '130%', background: 'radial-gradient(closest-side,rgba(45,212,191,.13),transparent 72%)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5eead4', background: 'rgba(45,212,191,.12)', border: '1px solid rgba(45,212,191,.35)' }}><I name="spin" size={22} /></span>
          <div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(17px,2.4vw,22px)', fontWeight: 700, color: '#fff', letterSpacing: '.04em' }}>Wheel of Fortune</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Spin to multiply your bet, up to {maxMult}×</div>
          </div>
        </div>
        <div style={{ fontSize: 11, padding: '5px 14px', borderRadius: 99, background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.35)', color: '#fbbf24', fontWeight: 800, letterSpacing: '.12em' }}>DEMO</div>
      </div>

      {!hasDeposit ? (
        /* Locked state */
        <div style={{ position: 'relative', textAlign: 'center', padding: '36px 16px 28px' }}>
          <div style={{ width: 72, height: 72, margin: '0 auto 16px', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)' }}><I name="lock" size={32} stroke={1.6} /></div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Free Spin Locked</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 22, lineHeight: 1.7 }}>Deposit now to unlock 7 days of daily free spins!</div>
          <Link href="/dashboard/deposit" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 26px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: 12, fontSize: 14, fontWeight: 800, color: '#000', textDecoration: 'none', boxShadow: '0 10px 26px rgba(251,191,36,.25)' }}>Deposit Now <I name="arrow" size={16} stroke={2.4} /></Link>
        </div>
      ) : (
        <div style={{ position: 'relative', display: 'flex', gap: 'clamp(24px,4vw,56px)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          {/* Controls */}
          <div style={{ minWidth: 260, flex: '1 1 300px', maxWidth: 460 }}>
            {/* Wallet selector */}
            <div style={{ marginBottom: 20 }}>
              <div style={smallLabel}>Bet From</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['cash', 'Cash', wallet?.cash_balance_cents], ['bonus', 'Bonus', wallet?.bonus_balance_cents]].map(([key, name, cents]) => (
                  <button key={key} onClick={() => setBucket(key)} style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', background: bucket === key ? 'linear-gradient(135deg,rgba(45,212,191,.2),rgba(45,212,191,.06))' : 'rgba(255,255,255,.04)', border: `1px solid ${bucket === key ? 'rgba(45,212,191,.6)' : 'rgba(255,255,255,.1)'}`, color: '#fff', transition: 'all .2s' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: bucket === key ? '#5eead4' : 'rgba(255,255,255,.45)' }}>{name}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>${((cents || 0) / 100).toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bet amount */}
            <div style={{ marginBottom: 20 }}>
              <div style={smallLabel}>Bet Amount</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => changeBet(-1)} style={stepBtn} aria-label="Lower bet">−</button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 32, fontWeight: 800, color: '#fbbf24', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>${(betCents / 100).toFixed(2)}</div>
                <button onClick={() => changeBet(1)} style={stepBtn} aria-label="Raise bet">+</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
                {[500, 1000, 2500, 5000].map(v => (
                  <button key={v} onClick={() => setBetCents(v)} style={{ padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, background: betCents === v ? 'rgba(251,191,36,.18)' : 'rgba(255,255,255,.04)', border: `1px solid ${betCents === v ? 'rgba(251,191,36,.6)' : 'rgba(255,255,255,.1)'}`, color: betCents === v ? '#fbbf24' : 'rgba(255,255,255,.65)', transition: 'all .2s' }}>${v / 100}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 10, textAlign: 'center' }}>Top prize: <span style={{ color: '#5eead4', fontWeight: 800 }}>${((betCents * maxMult) / 100).toFixed(2)}</span> ({maxMult}×)</div>
            </div>

            {err && <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, padding: '10px 14px', fontWeight: 600 }}>{err}</div>}

            {/* Result */}
            {result && (
              <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: won ? 'linear-gradient(135deg,rgba(16,185,129,.18),rgba(16,185,129,.05))' : 'linear-gradient(135deg,rgba(239,68,68,.14),rgba(239,68,68,.04))', border: `1px solid ${won ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.3)'}` }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>{won ? '🎉 You won' : '💸 You get back'}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>${(result.winCents / 100).toFixed(2)}</div>
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: won ? '#10b981' : '#f87171' }}>{result.seg.label}</div>
              </div>
            )}

            {/* Spin button */}
            <button onClick={spin} disabled={spinning} style={{ position: 'relative', overflow: 'hidden', width: '100%', padding: '15px', background: spinning ? 'rgba(255,255,255,.07)' : 'linear-gradient(135deg,#fbbf24,#d97706)', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, color: spinning ? 'rgba(255,255,255,.5)' : '#000', cursor: spinning ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: spinning ? 'none' : '0 12px 30px rgba(251,191,36,.25)', transition: 'transform .2s,box-shadow .2s' }}>
              {spinning ? 'Spinning…' : 'Spin Now!'}
            </button>

            {/* History */}
            {history.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={smallLabel}>Spin History</div>
                <div style={{ background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.35)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    <span>#</span><span>Result</span><span style={{ textAlign: 'right' }}>Win</span>
                  </div>
                  {history.map((h, i) => (
                    <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr', padding: '9px 14px', borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', fontSize: 13 }}>
                      <span style={{ color: 'rgba(255,255,255,.3)' }}>{i + 1}</span>
                      <span style={{ fontWeight: 800, color: '#fbbf24' }}>{h.label}</span>
                      <span style={{ textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: h.win >= betCents ? '#10b981' : '#f87171' }}>${(h.win / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Wheel */}
          <div style={{ flex: '1 1 340px', display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
            <SpinnerWheel spinning={spinning} finalAngle={finalAngle} onDone={handleSpinDone} onSpin={spin} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DAILY BONUS COUNTDOWN ────────────────────────────────────────────────────
function DailyBonusCard() {
  const [timeLeft, setTimeLeft] = useState('')
  const [claimed, setClaimed]   = useState(false)

  useEffect(() => {
    function tick() {
      const now  = new Date()
      const next = new Date(now)
      next.setHours(24, 0, 0, 0)
      const diff = next - now
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(251,191,36,.08),rgba(245,158,11,.04))', border: '1px solid rgba(251,191,36,.2)', borderRadius: 18, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 24 }}>🎁</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Daily Bonus</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Resets every midnight</div>
        </div>
      </div>
      {claimed ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginBottom: 4 }}>✅ Claimed! Next in:</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>{timeLeft}</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Today's reward</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>$0.50 Bonus</div>
          </div>
          <button onClick={() => setClaimed(true)} style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg,#fbbf24,#d97706)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, color: '#000', cursor: 'pointer' }}>
            Claim Now 🎁
          </button>
        </>
      )}
    </div>
  )
}

// ─── VIP PROGRESS ─────────────────────────────────────────────────────────────
function VIPProgressCard({ level, profile }) {
  if (!level) return null
  const xp = profile?.total_xp || 0
  const pct = Math.min(100, (xp / Math.max(level.xp_required, 1)) * 100)

  return (
    <div style={{ ...PANEL, borderRadius: 18, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={LABEL}>VIP Level</span>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: `${level.badge_color}22`, color: level.badge_color, fontWeight: 800, border: `1px solid ${level.badge_color}44` }}>{level.name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${level.badge_color}22`, border: `2px solid ${level.badge_color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⭐</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{xp} XP</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{level.xp_required} XP</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg,${level.badge_color},${level.badge_color}aa)`, borderRadius: 4, width: `${pct}%`, transition: 'width .6s' }} />
          </div>
        </div>
      </div>
      <Link href="/dashboard/rewards" style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, textDecoration: 'none' }}>View VIP benefits →</Link>
    </div>
  )
}

// ─── LUCKY NUMBER ─────────────────────────────────────────────────────────────
function LuckyNumberCard() {
  const [nums, setNums] = useState([])
  const [rolling, setRolling] = useState(false)

  function roll() {
    if (rolling) return
    setRolling(true)
    let count = 0
    const id = setInterval(() => {
      setNums(Array.from({ length: 6 }, () => Math.floor(Math.random() * 59) + 1))
      count++
      if (count >= 20) { clearInterval(id); setRolling(false) }
    }, 80)
  }

  return (
    <div style={{ ...PANEL, borderRadius: 18, padding: '18px 20px' }}>
      <div style={{ ...LABEL, marginBottom: 14 }}>🍀 Lucky Numbers</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {nums.length === 0
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.2)' }}>?</div>
            ))
          : nums.map((n, i) => {
              const colors = ['#ef4444','#fbbf24','#10b981','#3b82f6','#8b5cf6','#ec4899']
              return (
                <div key={i} style={{ width: 38, height: 38, borderRadius: '50%', background: `${colors[i]}22`, border: `2px solid ${colors[i]}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: colors[i] }}>{n}</div>
              )
            })
        }
      </div>
      <button onClick={roll} disabled={rolling} style={{ width: '100%', padding: '9px', background: rolling ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, fontSize: 13, fontWeight: 700, color: rolling ? 'rgba(255,255,255,.3)' : '#fff', cursor: rolling ? 'not-allowed' : 'pointer' }}>
        {rolling ? '🎲 Rolling...' : '🎲 Roll Numbers'}
      </button>
    </div>
  )
}

// ─── QUICK ACTION CARD ─────────────────────────────────────────────────────────
function QuickAction({ href, icon, label, desc, color }) {
  const [hov, setHov] = useState(false)
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ position: 'relative', overflow: 'hidden', padding: '20px', borderRadius: 20, height: '100%', background: hov ? `linear-gradient(145deg,${color}28,#0e1627 72%)` : 'linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.016))', border: `1px solid ${hov ? color + '88' : 'rgba(255,255,255,.08)'}`, transform: hov ? 'translateY(-5px)' : 'none', boxShadow: hov ? `0 20px 40px rgba(0,0,0,.42), 0 0 30px ${color}24` : '0 8px 20px rgba(0,0,0,.22)', transition: 'all .3s cubic-bezier(.2,.8,.2,1)', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ width: 46, height: 46, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0a', background: `linear-gradient(135deg,${color},${color}bb)`, boxShadow: `0 8px 22px ${color}44`, transform: hov ? 'rotate(-6deg) scale(1.05)' : 'none', transition: 'transform .3s' }}><I name={icon} size={22} stroke={2} /></span>
          <span style={{ color, opacity: hov ? 1 : 0.3, transform: hov ? 'translateX(0)' : 'translateX(-8px)', transition: 'all .3s' }}><I name="arrow" size={20} stroke={2.2} /></span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 5 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.55 }}>{desc}</div>
      </div>
    </Link>
  )
}

// ─── WALLET CARD ───────────────────────────────────────────────────────────────
function WalletCard({ label, cents, color, icon, sub }) {
  return (
    <div className="wc" style={{ position: 'relative', overflow: 'hidden', padding: '24px 24px 22px', background: 'linear-gradient(180deg,#121d33,#0b1322)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent 85%)` }} />
      <div style={{ position: 'absolute', right: -30, top: -30, width: 110, height: 110, borderRadius: '50%', background: `radial-gradient(closest-side,${color}1c,transparent)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
        <span style={{ width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color, background: `${color}1f`, border: `1px solid ${color}44` }}><I name={icon} size={17} /></span>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>{label}</span>
      </div>
      <div className="wc-num" style={{ position: 'relative' }}><MoneyDisplay cents={cents} size="xl" color={color} /></div>
      {sub && <div style={{ position: 'relative', fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 9 }}>{sub}</div>}
    </div>
  )
}

// ─── PENDING BADGE ─────────────────────────────────────────────────────────────
function PendingCard({ label, count, href, color }) {
  if (!count) return null
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 14, background: `${color}12`, border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`, marginBottom: 8, transition: 'all .15s' }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}20`}
      onMouseLeave={e => e.currentTarget.style.background = `${color}12`}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>{label}</span>
      <span style={{ background: color, color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99 }}>{count} pending</span>
    </Link>
  )
}

// ─── PROMO BANNER ─────────────────────────────────────────────────────────────
function PromoBanner() {
  const promos = [
    { emoji: '💰', title: 'First Deposit Bonus', desc: '100% match up to $200 on your first deposit!', color: '#10b981', href: '/dashboard/deposit' },
    { emoji: '🎁', title: 'Reload Bonus', desc: '50% bonus every Friday — max $100', color: '#3b82f6', href: '/dashboard/deposit' },
    { emoji: '⭐', title: 'VIP Cashback', desc: 'Earn up to 15% cashback as a VIP member', color: '#8b5cf6', href: '/dashboard/rewards' },
  ]
  const [idx, setIdx] = useState(0)
  useEffect(() => { const id = setInterval(() => setIdx(i => (i + 1) % promos.length), 4000); return () => clearInterval(id) }, [])
  const p = promos[idx]

  return (
    <Link href={p.href} style={{ textDecoration: 'none', display: 'block', marginBottom: 24 }}>
      <div style={{ padding: '16px 20px', borderRadius: 16, background: `linear-gradient(135deg,${p.color}18,${p.color}06)`, border: `1px solid ${p.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .3s', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>{p.emoji}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{p.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>{p.desc}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: p.color, fontWeight: 700 }}>Claim →</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {promos.map((_, i) => <div key={i} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, background: i === idx ? p.color : 'rgba(255,255,255,.2)', transition: 'all .3s' }} />)}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── STATS ROW ────────────────────────────────────────────────────────────────
function StatsRow({ wallet, transactions }) {
  const totalIn  = transactions.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount_cents, 0)
  const totalOut = transactions.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount_cents, 0)
  const balance  = (wallet?.cash_balance_cents || 0) + (wallet?.bonus_balance_cents || 0)

  const stats = [
    { label: 'Balance',         cents: balance,                              color: '#fbbf24', icon: 'wallet' },
    { label: 'Total Deposited', cents: wallet?.total_deposited_cents || 0,   color: '#10b981', icon: 'plus' },
    { label: 'Total Withdrawn', cents: wallet?.total_withdrawn_cents || 0,   color: '#60a5fa', icon: 'out' },
    { label: 'Money In',        cents: totalIn,                              color: '#34d399', icon: 'down' },
    { label: 'Money Out',       cents: totalOut,                             color: '#f87171', icon: 'up' },
    { label: 'Transactions',    count: transactions.length,                  color: '#a78bfa', icon: 'list' },
  ]
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ ...LABEL, marginBottom: 12 }}>Overview</div>
      <div style={{ ...PANEL, borderRadius: 22, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(170px,100%),1fr))', gap: 1, background: 'rgba(251,191,36,.12)' }}>
        {stats.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 16px', background: 'linear-gradient(180deg,#0f192c,#0b1322)' }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, background: `${s.color}1c`, border: `1px solid ${s.color}3d`, flexShrink: 0 }}><I name={s.icon} size={17} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', lineHeight: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 3 }}>{s.label}</div>
              {s.count !== undefined
                ? <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.count}</div>
                : <MoneyDisplay cents={s.cents} size="lg" color={s.color} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter()
  const [user, setUser]               = useState(null)
  const [profile, setProfile]         = useState(null)
  const [wallet, setWallet]           = useState(null)
  const [transactions, setTransactions] = useState([])
  const [gameAccounts, setGameAccounts] = useState([])
  const [pending, setPending]         = useState({ deposits: 0, loads: 0, redeems: 0, withdrawals: 0 })
  const [level, setLevel]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [panels, setPanels]           = useState([])
  const [unread, setUnread]           = useState(0)

  useEffect(() => {
    supabase.from('game_panels').select('id,name,logo_url,accent_color,default_bonus_pct').eq('is_active', true).order('sort_order').then(({ data }) => setPanels(data || []))
  }, [])

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { router.push('/auth/login'); return }
    setUser(u)
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', u.id).eq('is_read', false)
      .then(({ count }) => setUnread(count || 0), () => {})
    try {
      const [{ data: prof }, { data: wal }, txs, accounts, counts] = await Promise.all([
        supabase.from('profiles').select('*, kyc_records(status)').eq('id', u.id).single(),
        supabase.from('wallets').select('*').eq('user_id', u.id).single(),
        getMyTransactions(u.id, { limit: 8 }),
        getMyGameAccounts(u.id),
        getMyPendingCounts(u.id),
      ])
      setProfile(prof); setWallet(wal)
      setTransactions(txs || []); setGameAccounts(accounts || [])
      setPending(counts)
      if (prof?.player_level_id) {
        const { data: lvl } = await supabase.from('player_levels').select('*').eq('id', prof.player_level_id).single()
        setLevel(lvl)
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalPending = pending.deposits + pending.loads + pending.redeems + pending.withdrawals

  if (loading) return (
    <PlayerLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚡</div>
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Loading your dashboard…</div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PlayerLayout>
  )

  return (
    <PlayerLayout>
      <Head><title>Dashboard — Casinoze Room</title></Head>

      {/* WELCOME */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Player'} 👋
        </h1>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        </div>
        <Link href="/dashboard/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} style={{ position: 'relative', flexShrink: 0, width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(251,191,36,.25)', color: '#fbbf24' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0" /></svg>
          {unread > 0 && <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, textAlign: 'center', background: '#fbbf24', color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 5px', borderRadius: 99 }}>{unread > 99 ? '99+' : unread}</span>}
        </Link>
      </div>

      {/* KYC BANNER */}
      {profile?.kyc_status === 'not_started' && (
        <Link href="/dashboard/kyc" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderRadius: 14, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>Verify Your Identity</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>Complete KYC to unlock withdrawals and higher limits</div>
              </div>
            </div>
            <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>Verify Now →</span>
          </div>
        </Link>
      )}

      {/* PROMO BANNER */}
      <PromoBanner />

      {/* WALLET BALANCES */}
      {wallet && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ ...LABEL, marginBottom: 12 }}>Your Wallet</div>
          <div className="wl-grid" style={{ ...PANEL, borderRadius: 24, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px,100%),1fr))', gap: 1, background: 'rgba(251,191,36,.14)' }}>
            <WalletCard label="Cash"         cents={wallet.cash_balance_cents}   color="#10b981" icon="wallet" sub="Available to play" />
            <WalletCard label="Bonus"        cents={wallet.bonus_balance_cents}  color="#f59e0b" icon="gift"   sub="Bonus credits" />
            <WalletCard label="Reserved"     cents={wallet.reserved_cents}       color="#94a3b8" icon="lock"   sub="Held pending" />
            <WalletCard label="Withdrawable" cents={wallet.withdrawable_cents}   color="#fbbf24" icon="out"    sub="Ready to withdraw" />
          </div>
        </div>
      )}

      {/* STATS ROW */}
      <StatsRow wallet={wallet} transactions={transactions} />

      {/* QUICK ACTIONS */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ ...LABEL, marginBottom: 12 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px,100%),1fr))', gap: 12 }}>
          <QuickAction href="/dashboard/deposit"   icon="plus" label="Add Money"  desc="Deposit funds to your wallet"   color="#10b981" />
          <QuickAction href="/dashboard/load-game" icon="gamepad" label="Load Game"  desc="Send credits to a game room"    color="#fbbf24" />
          <QuickAction href="/dashboard/redeem"    icon="trophy" label="Redeem"     desc="Request a redemption from game" color="#f59e0b" />
          <QuickAction href="/dashboard/withdraw"  icon="out" label="Withdraw"   desc="Withdraw to your account"      color="#3b82f6" />
        </div>
      </div>

      {/* WHEEL OF FORTUNE */}
      <WheelSection wallet={wallet} />

      {/* GAMES STRIP */}
      {panels.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={LABEL}>Our Games</span>
            <Link href="/dashboard/games" style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '8px 4px 16px', scrollbarWidth: 'thin' }}>
            {panels.map((g, i) => {
              const logo = g.logo_url || gameLogoFor(g.slug, g.name)
              const t = TILE_TINTS[i % TILE_TINTS.length]
              return (
                <Link key={g.id} href="/dashboard/games" className="hg" style={{ '--g1': t[0], '--g2': t[1] }}>
                  {g.default_bonus_pct > 0 && <span className="hg-b">{g.default_bonus_pct}%</span>}
                  <div className="hg-art">{logo ? <img src={logo} alt={g.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} /> : <span style={{ fontSize: 36 }}>🎮</span>}</div>
                  <div className="hg-bar"><span className="hg-p">▶</span><span className="hg-n">{g.name}</span></div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* PENDING REQUESTS */}
      {totalPending > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...LABEL, marginBottom: 12 }}>
            Pending Requests <span style={{ background: '#fbbf24', color: '#000', fontSize: 9, padding: '2px 7px', borderRadius: 99, marginLeft: 6, fontWeight: 800 }}>{totalPending}</span>
          </div>
          <PendingCard label="Deposits"    count={pending.deposits}    href="/dashboard/deposit"       color="#10b981" />
          <PendingCard label="Game Loads"  count={pending.loads}       href="/dashboard/game-accounts" color="#fbbf24" />
          <PendingCard label="Redemptions" count={pending.redeems}     href="/dashboard/redeem"        color="#f59e0b" />
          <PendingCard label="Withdrawals" count={pending.withdrawals} href="/dashboard/withdraw"      color="#3b82f6" />
        </div>
      )}

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20 }}>

        {/* Recent Transactions */}
        <div style={{ ...PANEL, borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Recent Transactions</span>
            <Link href="/dashboard/transactions" style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
          </div>
          {transactions.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>No transactions yet</div>
              <Link href="/dashboard/deposit" style={{ display: 'inline-block', marginTop: 12, color: '#fbbf24', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Make your first deposit →</Link>
            </div>
          ) : (
            <div>
              {transactions.map((tx, i) => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: txTypeColor(tx.type) === '#10b981' ? 'rgba(16,185,129,.12)' : 'rgba(248,113,113,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                      {tx.direction === 'credit' ? '⬆️' : '⬇️'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{txTypeLabel(tx.type)}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: txTypeColor(tx.type) }}>
                      {tx.direction === 'credit' ? '+' : '-'}<MoneyDisplay cents={tx.amount_cents} size="sm" color={txTypeColor(tx.type)} />
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{tx.wallet_bucket}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DailyBonusCard />
          <VIPProgressCard level={level} profile={profile} />
          <LuckyNumberCard />

          {/* My Game Accounts */}
          <div style={{ ...PANEL, borderRadius: 18, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={LABEL}>My Games</span>
              <Link href="/dashboard/games" style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, textDecoration: 'none' }}>+ Add</Link>
            </div>
            {gameAccounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🎮</div>
                <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, marginBottom: 10 }}>No game accounts yet</div>
                <Link href="/dashboard/games" style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, textDecoration: 'none' }}>Browse Games →</Link>
              </div>
            ) : (
              gameAccounts.slice(0, 4).map(ga => (
                <div key={ga.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ga.game_panels?.accent_color || '#fbbf24'}22`, border: `1px solid ${ga.game_panels?.accent_color || '#fbbf24'}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🎮</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ga.game_panels?.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{ga.game_username || 'Pending setup'}</div>
                  </div>
                  <StatusBadge status={ga.status} size="xs" />
                </div>
              ))
            )}
          </div>

          {/* Verification status */}
          <div style={{ ...PANEL, borderRadius: 18, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>🔐 Verification</span>
              <StatusBadge status={profile?.kyc_status || 'not_started'} size="xs" />
            </div>
            {profile?.kyc_status !== 'verified' && (
              <Link href="/dashboard/kyc" style={{ display: 'block', marginTop: 10, fontSize: 12, color: '#fbbf24', fontWeight: 600, textDecoration: 'none' }}>
                {profile?.kyc_status === 'not_started' ? 'Start verification →' : 'Check status →'}
              </Link>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dash-main-grid { grid-template-columns: 1fr !important; }
        }
        .hg{position:relative;flex:0 0 150px;display:block;text-decoration:none;color:#fff;border-radius:18px;overflow:hidden;background:linear-gradient(165deg,var(--g1) 0%,var(--g2) 62%,#0a1222 100%);border:1px solid rgba(255,255,255,.1);box-shadow:0 8px 22px rgba(0,0,0,.35);transition:transform .3s cubic-bezier(.2,.9,.3,1.35),box-shadow .3s,border-color .3s}
        .hg::after{content:'';position:absolute;top:0;left:-70%;width:45%;height:100%;pointer-events:none;background:linear-gradient(105deg,transparent,rgba(255,255,255,.24),transparent);transform:skewX(-18deg);transition:left .7s}
        .hg-art{height:128px;display:flex;align-items:center;justify-content:center;padding:16px 12px 6px}
        .hg-art img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5));transition:transform .35s cubic-bezier(.2,.9,.3,1.35)}
        .hg-bar{display:flex;align-items:center;gap:7px;padding:11px 12px;background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.6));border-top:1px solid rgba(255,255,255,.08);font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.88)}
        .hg-p{font-size:8px;color:#fbbf24}.hg-n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .hg-b{position:absolute;top:0;right:0;z-index:2;background:#e5484d;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-bottom-left-radius:10px}
        .hg:hover{transform:translateY(-8px) scale(1.05);border-color:#fbbf24;box-shadow:0 22px 40px rgba(0,0,0,.55),0 0 0 1px #fbbf24,0 0 30px rgba(251,191,36,.35);z-index:3}
        .hg:hover::after{left:135%}.hg:hover .hg-art img{transform:scale(1.1) translateY(-3px)}
        @media(max-width:560px){.wl-grid{grid-template-columns:1fr 1fr!important}.wl-grid .wc{padding:16px 14px 14px!important}.wc-num *{font-size:22px!important}}
        @media(prefers-reduced-motion:reduce){.hg,.hg-art img{transition:none}.hg:hover{transform:none}}
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </PlayerLayout>
  )
}
