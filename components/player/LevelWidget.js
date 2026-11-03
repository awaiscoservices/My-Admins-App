/**
 * LevelWidget — shows current level badge, XP bar, next level progress
 * Used on player dashboard
 */
export default function LevelWidget({ level, xp }) {
  if (!level || !xp) return null

  const accent = level.accent_color || '#fbbf24'
  const pct    = xp.progress_pct ?? 0

  return (
    <div style={{
      background:   `linear-gradient(135deg, rgba(0,0,0,.4) 0%, rgba(0,0,0,.2) 100%)`,
      border:       `1px solid ${accent}40`,
      borderRadius: 20,
      padding:      24,
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 160, height: 160, borderRadius: '50%',
        background: `${accent}18`, filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>
            Current Level
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: accent, fontFamily: "'Cinzel',serif", lineHeight: 1 }}>
            {level.name}
          </div>
        </div>
        {/* Level badge */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background:  `linear-gradient(135deg, ${accent}, ${accent}88)`,
          display:     'flex', alignItems: 'center', justifyContent: 'center',
          fontSize:    22, fontWeight: 900, color: '#000',
          boxShadow:   `0 0 24px ${accent}50`,
          flexShrink:  0,
          fontFamily:  "'Cinzel',serif",
        }}>
          {level.name[0]}
        </div>
      </div>

      {/* XP numbers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
          <span style={{ color: '#fff', fontWeight: 700 }}>{xp.current.toLocaleString()}</span> XP
        </span>
        {xp.next_level && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>
            {xp.to_next?.toLocaleString()} to <span style={{ color: accent }}>{xp.next_level.name}</span>
          </span>
        )}
        {!xp.next_level && (
          <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>MAX LEVEL</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8, borderRadius: 99,
        background: 'rgba(255,255,255,.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width:  `${pct}%`,
          borderRadius: 99,
          background:   `linear-gradient(90deg, ${accent}88, ${accent})`,
          transition:   'width .6s cubic-bezier(.4,0,.2,1)',
          boxShadow:    `0 0 10px ${accent}80`,
        }} />
      </div>

      {/* Perks row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Perk label="Deposit Bonus" value={`${level.deposit_bonus_pct ?? 0}%`} accent={accent} />
        <Perk label="Daily Withdraw" value={`$${((level.daily_withdrawal_limit_cents || 0) / 100).toLocaleString()}`} accent={accent} />
        <Perk label="Bonus → Cash" value={`${level.bonus_to_cash_pct ?? 10}%`} accent={accent} />
      </div>
    </div>
  )
}

function Perk({ label, value, accent }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  )
}
