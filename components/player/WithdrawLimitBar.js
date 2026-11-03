/**
 * WithdrawLimitBar — shows daily withdrawal used / remaining for current level
 * Used on Withdraw screen
 */
export default function WithdrawLimitBar({ withdrawalToday, level }) {
  if (!withdrawalToday) return null

  const { withdrawn_cents, limit_cents, remaining_cents, pct_used } = withdrawalToday

  const fmt = cents => `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const color = pct_used >= 100 ? '#ef4444' : pct_used >= 80 ? '#f59e0b' : '#22c55e'

  return (
    <div style={{
      background:   'rgba(255,255,255,.03)',
      border:       `1px solid rgba(255,255,255,.07)`,
      borderRadius: 14,
      padding:      16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 2 }}>
            Daily Withdrawal Limit
          </div>
          {level && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
              {level.name} tier · resets every 24 hours
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color }}>
            {fmt(remaining_cents)}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>remaining</div>
        </div>
      </div>

      {/* Bar */}
      <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height:     '100%',
          width:      `${Math.min(100, pct_used)}%`,
          borderRadius: 99,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          transition: 'width .5s ease',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
          Used: <strong style={{ color: '#fff' }}>{fmt(withdrawn_cents)}</strong>
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
          Limit: <strong style={{ color: '#fff' }}>{fmt(limit_cents)}</strong>
        </span>
      </div>

      {pct_used >= 100 && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, fontSize: 12, color: '#f87171', fontWeight: 600, textAlign: 'center' }}>
          ⛔ Daily limit reached. Resets in less than 24 hours.
        </div>
      )}
    </div>
  )
}
