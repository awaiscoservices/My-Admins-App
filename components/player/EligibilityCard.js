/**
 * EligibilityCard — per game account eligibility breakdown
 * Shows for each game account:
 *   - Total loaded, total redeemed, eligible amount, remaining
 * Used on My Games and Redeem screens
 */
export default function EligibilityCard({ account }) {
  if (!account) return null
  const e = account.eligibility

  const fmt = cents => `$${((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const remainingCents  = e?.remaining_cents  || 0
  const eligibleCents   = e?.eligible_cents   || 0
  const totalLoaded     = e?.total_loaded_cents || 0
  const totalRedeemed   = e?.total_redeemed_cents || 0
  const multiplier      = e?.multiplier_used || 1
  const usedPct         = eligibleCents > 0 ? Math.min(100, Math.round(((eligibleCents - remainingCents) / eligibleCents) * 100)) : 0

  return (
    <div style={{
      background:   'rgba(255,255,255,.03)',
      border:       '1px solid rgba(255,255,255,.08)',
      borderRadius: 16,
      padding:      18,
    }}>
      {/* Account header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{account.panel_name || 'Game Panel'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>@{account.username}</div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800,
          background: remainingCents > 0 ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)',
          color:      remainingCents > 0 ? '#22c55e'             : 'rgba(255,255,255,.3)',
          letterSpacing: '.08em', textTransform: 'uppercase',
        }}>
          {remainingCents > 0 ? 'Eligible' : 'Maxed'}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <Stat label="Total Loaded"   value={fmt(totalLoaded)}   />
        <Stat label="Total Redeemed" value={fmt(totalRedeemed)} />
        <Stat label="Max Eligible"   value={fmt(eligibleCents)} sub={`${multiplier}× multiplier`} />
        <Stat label="Remaining"      value={fmt(remainingCents)} highlight={remainingCents > 0} />
      </div>

      {/* Progress bar */}
      {eligibleCents > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>Redemption used</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>{usedPct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
            <div style={{
              height:     '100%',
              width:      `${usedPct}%`,
              borderRadius: 99,
              background: usedPct >= 100
                ? 'linear-gradient(90deg,#ef4444,#dc2626)'
                : 'linear-gradient(90deg,#6366f1,#818cf8)',
              transition: 'width .4s ease',
            }} />
          </div>
        </>
      )}

      {!e && (
        <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.25)' }}>
          No loads yet — eligibility will appear after first approved load
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, highlight }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: highlight ? '#22c55e' : '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
