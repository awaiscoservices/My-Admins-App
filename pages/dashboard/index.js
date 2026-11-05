import { useEffect, useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import PlayerLayout from '../../components/layout/PlayerLayout'
import MoneyDisplay from '../../components/ui/MoneyDisplay'
import StatusBadge from '../../components/ui/StatusBadge'
import { getMyTransactions, getMyPendingCounts, getMyGameAccounts, txTypeLabel, txTypeColor } from '../../lib/wallet'

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

function SpinnerWheel({ spinning, finalAngle, onDone }) {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const startRef  = useRef(null)
  const startAngleRef = useRef(0)
  const currentAngleRef = useRef(0)
  const DURATION = 3800

  const draw = useCallback((angle) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, cx = W / 2, cy = W / 2, r = cx - 6

    ctx.clearRect(0, 0, W, W)

    // Shadow
    ctx.save()
    ctx.shadowColor = 'rgba(251,191,36,.35)'
    ctx.shadowBlur = 28
    ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.stroke()
    ctx.restore()

    // Segments
    SEGMENTS.forEach((seg, i) => {
      const start = angle + i * SEG_ANGLE - Math.PI / 2
      const end   = start + SEG_ANGLE
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, start, end)
      ctx.closePath()
      ctx.fillStyle = seg.color
      ctx.fill()
      ctx.strokeStyle = 'rgba(251,191,36,.5)'
      ctx.lineWidth = 1.5; ctx.stroke()

      // Label
      const mid = start + SEG_ANGLE / 2
      const tx = cx + (r * 0.68) * Math.cos(mid)
      const ty = cy + (r * 0.68) * Math.sin(mid)
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(mid + Math.PI / 2)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${seg.multiplier >= 3 ? 13 : 11}px Outfit, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(seg.label, 0, 0)
      ctx.restore()
    })

    // Center cap
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20)
    grad.addColorStop(0, '#fbbf24'); grad.addColorStop(1, '#d97706')
    ctx.fillStyle = grad; ctx.fill()
    ctx.strokeStyle = '#fff3'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px Outfit, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('SPIN', cx, cy)
  }, [])

  useEffect(() => { draw(0) }, [draw])

  useEffect(() => {
    if (!spinning) return
    const totalRotation = Math.PI * 2 * 8 + finalAngle
    startRef.current = null
    startAngleRef.current = currentAngleRef.current

    function animate(ts) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const t = Math.min(elapsed / DURATION, 1)
      // ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3)
      const angle = startAngleRef.current + totalRotation * ease
      currentAngleRef.current = angle
      draw(angle)
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        currentAngleRef.current = finalAngle
        onDone && onDone()
      }
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning, finalAngle, draw, onDone])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Pointer */}
      <div style={{
        position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '10px solid transparent',
        borderRight: '10px solid transparent',
        borderTop: '22px solid #fbbf24',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.5))',
        zIndex: 10,
      }} />
      <canvas ref={canvasRef} width={260} height={260}
        style={{ borderRadius: '50%', display: 'block' }} />
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

  return (
    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '24px', marginBottom: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700, color: '#fbbf24', letterSpacing: '.05em' }}>🎡 Wheel of Fortune</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>Spin to multiply your bet!</div>
        </div>
        <div style={{ fontSize: 11, padding: '4px 12px', borderRadius: 99, background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', color: '#fbbf24', fontWeight: 700 }}>DEMO</div>
      </div>

      {!hasDeposit ? (
        /* Locked state */
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Free Spin Locked</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 20, lineHeight: 1.6 }}>
            Deposit now to unlock 7 days of daily free spins!
          </div>
          <Link href="/dashboard/deposit" style={{ display: 'inline-block', padding: '10px 24px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: 10, fontSize: 13, fontWeight: 800, color: '#000', textDecoration: 'none' }}>
            Deposit Now →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
          {/* Controls */}
          <div style={{ minWidth: 200, flex: 1 }}>
            {/* Wallet selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 6 }}>Bet From</div>
              <select value={bucket} onChange={e => setBucket(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#fff', outline: 'none' }}>
                <option value="cash">Cash — ${((wallet?.cash_balance_cents || 0) / 100).toFixed(2)}</option>
                <option value="bonus">Bonus — ${((wallet?.bonus_balance_cents || 0) / 100).toFixed(2)}</option>
              </select>
            </div>

            {/* Bet amount */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 6 }}>Bet Amount</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => changeBet(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>${(betCents / 100).toFixed(2)}</div>
                <button onClick={() => changeBet(1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              {/* Presets */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {[500, 1000, 2500, 5000].map(v => (
                  <button key={v} onClick={() => setBetCents(v)} style={{ flex: 1, padding: '5px 4px', borderRadius: 8, background: betCents === v ? 'rgba(251,191,36,.2)' : 'rgba(255,255,255,.04)', border: `1px solid ${betCents === v ? 'rgba(251,191,36,.5)' : 'rgba(255,255,255,.08)'}`, color: betCents === v ? '#fbbf24' : 'rgba(255,255,255,.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    ${v / 100}
                  </button>
                ))}
              </div>
            </div>

            {err && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '8px 12px' }}>{err}</div>}

            {/* Result */}
            {result && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: result.seg.multiplier >= 1 ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.08)', border: `1px solid ${result.seg.multiplier >= 1 ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.2)'}`, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: result.seg.multiplier >= 1 ? '#10b981' : '#ef4444' }}>{result.seg.label}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
                  {result.seg.multiplier >= 1 ? '🎉 You won ' : '💸 You get back '}
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>${(result.winCents / 100).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Spin button */}
            <button onClick={spin} disabled={spinning} style={{ width: '100%', padding: '13px', background: spinning ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#fbbf24,#d97706)', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, color: spinning ? 'rgba(255,255,255,.3)' : '#000', cursor: spinning ? 'not-allowed' : 'pointer', transition: 'all .2s', letterSpacing: '.04em' }}>
              {spinning ? '🌀 Spinning...' : '🎡 Spin Now!'}
            </button>

            {/* History */}
            {history.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 8 }}>Spin History</div>
                <div style={{ background: 'rgba(0,0,0,.2)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    <span>#</span><span>Result</span><span style={{ textAlign: 'right' }}>Win</span>
                  </div>
                  {history.map((h, i) => (
                    <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', padding: '7px 10px', borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', fontSize: 12 }}>
                      <span style={{ color: 'rgba(255,255,255,.3)' }}>{i + 1}</span>
                      <span style={{ fontWeight: 700, color: '#fbbf24' }}>{h.label}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, color: h.win >= betCents ? '#10b981' : '#ef4444' }}>${(h.win / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Wheel canvas */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
            <SpinnerWheel spinning={spinning} finalAngle={finalAngle} onDone={handleSpinDone} />
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
    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>VIP Level</span>
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
    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 14 }}>🍀 Lucky Numbers</div>
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
    <Link href={href} style={{ textDecoration: 'none' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ padding: '20px', borderRadius: 16, background: hov ? `linear-gradient(135deg,${color}22,${color}08)` : 'rgba(255,255,255,.03)', border: `1px solid ${hov ? color + '66' : 'rgba(255,255,255,.07)'}`, transition: 'all .2s', transform: hov ? 'translateY(-3px)' : 'none', boxShadow: hov ? `0 12px 40px rgba(0,0,0,.4), 0 0 20px ${color}22` : 'none', cursor: 'pointer' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </Link>
  )
}

// ─── WALLET CARD ───────────────────────────────────────────────────────────────
function WalletCard({ label, cents, color, icon, sub }) {
  return (
    <div style={{ padding: '22px', borderRadius: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>{label}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <MoneyDisplay cents={cents} size="xl" color={color} />
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ─── PENDING BADGE ─────────────────────────────────────────────────────────────
function PendingCard({ label, count, href, color }) {
  if (!count) return null
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: `${color}12`, border: `1px solid ${color}33`, marginBottom: 8, transition: 'all .15s' }}
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

  const stats = [
    { label: 'Total Balance', value: `$${(((wallet?.cash_balance_cents || 0) + (wallet?.bonus_balance_cents || 0)) / 100).toFixed(2)}`, color: '#fbbf24', icon: '💰' },
    { label: 'Money In',      value: `$${(totalIn / 100).toFixed(2)}`,  color: '#10b981', icon: '⬆️' },
    { label: 'Money Out',     value: `$${(totalOut / 100).toFixed(2)}`, color: '#ef4444', icon: '⬇️' },
    { label: 'Transactions',  value: transactions.length,               color: '#3b82f6', icon: '📋' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
      {stats.map(s => (
        <div key={s.label} style={{ padding: '16px', borderRadius: 14, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 3 }}>{s.label}</div>
        </div>
      ))}
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

  useEffect(() => {
    supabase.from('game_panels').select('id,name,logo_url,accent_color,default_bonus_pct').eq('is_active', true).order('sort_order').then(({ data }) => setPanels(data || []))
  }, [])

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { router.push('/auth/login'); return }
    setUser(u)
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Player'} 👋
        </h1>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
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
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Your Wallet</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px,100%),1fr))', gap: 12 }}>
            <WalletCard label="Cash"        cents={wallet.cash_balance_cents}   color="#10b981" icon="💵" sub="Available to play" />
            <WalletCard label="Bonus"       cents={wallet.bonus_balance_cents}  color="#f59e0b" icon="🎁" sub="Bonus credits" />
            <WalletCard label="Reserved"    cents={wallet.reserved_cents}       color="#94a3b8" icon="🔒" sub="Held pending" />
            <WalletCard label="Withdrawable" cents={wallet.withdrawable_cents}  color="#fbbf24" icon="💸" sub="Ready to withdraw" />
          </div>
        </div>
      )}

      {/* STATS ROW */}
      <StatsRow wallet={wallet} transactions={transactions} />

      {/* QUICK ACTIONS */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px,100%),1fr))', gap: 12 }}>
          <QuickAction href="/dashboard/deposit"   icon="➕" label="Add Money"  desc="Deposit funds to your wallet"   color="#10b981" />
          <QuickAction href="/dashboard/load-game" icon="🎮" label="Load Game"  desc="Send credits to a game room"    color="#fbbf24" />
          <QuickAction href="/dashboard/redeem"    icon="🏆" label="Redeem"     desc="Request a redemption from game" color="#f59e0b" />
          <QuickAction href="/dashboard/withdraw"  icon="💸" label="Withdraw"   desc="Withdraw to your account"      color="#3b82f6" />
        </div>
      </div>

      {/* WHEEL OF FORTUNE */}
      <WheelSection wallet={wallet} />

      {/* GAMES STRIP */}
      {panels.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>Our Games</span>
            <Link href="/dashboard/games" style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'thin' }}>
            {panels.map(g => {
              const c = g.accent_color || '#fbbf24'
              return (
                <Link key={g.id} href="/dashboard/games" style={{ textDecoration: 'none', flex: '0 0 130px', borderRadius: 16, overflow: 'hidden', position: 'relative', background: `linear-gradient(160deg,${c}33,#0a0a0a)`, border: `1px solid ${c}44` }}>
                  {g.default_bonus_pct > 0 && <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderBottomLeftRadius: 10 }}>{g.default_bonus_pct}%</span>}
                  <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                    {g.logo_url ? <img src={g.logo_url} alt={g.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 36 }}>🎮</span>}
                  </div>
                  <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'center', background: 'rgba(0,0,0,.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* PENDING REQUESTS */}
      {totalPending > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>
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
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, overflow: 'hidden' }}>
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
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)' }}>My Games</span>
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
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '16px 20px' }}>
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
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </PlayerLayout>
  )
}
