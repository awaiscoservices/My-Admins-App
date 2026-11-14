// Reusable From/To date-range filter with quick presets, for admin list
// pages. Controlled: pass { from, to } ('YYYY-MM-DD' or '') and onChange.
// Filtering is done client-side on the already-loaded rows via inDateRange,
// the same way the search boxes already work.
import Icon from './Icon'

// Local 'YYYY-MM-DD' for a Date (no UTC shift).
const iso = (d) => {
  const z = new Date(d)
  z.setMinutes(z.getMinutes() - z.getTimezoneOffset())
  return z.toISOString().slice(0, 10)
}

// True when a timestamp falls inside [from 00:00 … to 23:59:59] (either end
// optional). Empty range matches everything.
export function inDateRange(ts, from, to) {
  if (!from && !to) return true
  if (!ts) return false
  const d = new Date(ts)
  if (from && d < new Date(from + 'T00:00:00')) return false
  if (to && d > new Date(to + 'T23:59:59.999')) return false
  return true
}

const field = {
  padding: '8px 10px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 9, color: '#fff', fontSize: 12.5, fontFamily: "'Outfit',sans-serif", outline: 'none',
  colorScheme: 'dark',
}
const chip = (on) => ({
  padding: '7px 11px', borderRadius: 8, border: '1px solid ' + (on ? 'rgba(251,191,36,.5)' : 'rgba(255,255,255,.12)'),
  cursor: 'pointer', fontFamily: "'Outfit',sans-serif", fontSize: 11.5, fontWeight: 700,
  background: on ? 'rgba(251,191,36,.16)' : 'rgba(255,255,255,.04)', color: on ? '#fbbf24' : 'rgba(255,255,255,.5)',
  transition: 'all .15s', whiteSpace: 'nowrap',
})

export default function DateRange({ from = '', to = '', onChange }) {
  const now = new Date()
  const back = (days) => { const s = new Date(); s.setDate(now.getDate() - days); return { from: iso(s), to: iso(now) } }
  const monthStart = () => ({ from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) })

  // Which preset (if any) the current range matches, so the chip highlights.
  const eq = (r) => r.from === from && r.to === to
  const presets = [
    ['Today', back(0)],
    ['7D', back(6)],
    ['30D', back(29)],
    ['Month', monthStart()],
  ]
  const active = !!(from || to)

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {presets.map(([label, r]) => (
        <button key={label} type="button" onClick={() => onChange(r)} style={chip(eq(r))}>{label}</button>
      ))}
      <input type="date" value={from} max={to || undefined} onChange={e => onChange({ from: e.target.value, to })}
        aria-label="From date" style={field} />
      <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 12 }}>–</span>
      <input type="date" value={to} min={from || undefined} onChange={e => onChange({ from, to: e.target.value })}
        aria-label="To date" style={field} />
      {active && (
        <button type="button" onClick={() => onChange({ from: '', to: '' })} aria-label="Clear dates"
          title="Clear dates"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.55)', cursor: 'pointer' }}>
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  )
}
