/**
 * components/ui/Charts.js
 *
 * Shared, polished chart primitives for the admin + super-admin reports and
 * dashboard. Three components, all dark-theme and responsive:
 *
 *   <LineChart>  smooth gradient area/line, Y-axis ticks, gridlines, legend
 *   <BarChart>   slim rounded columns (never full-width blocks), axis + grid
 *   <Donut>      ring chart with rounded caps + a value/percent legend
 *
 * Props are flexible so both call styles work:
 *   LineChart: series=[{label,color,data|values}]  (datasets= also accepted)
 *   BarChart:  data=[{label,value,display}]  OR  labels=[], data=[n], display=[]
 *
 * Pass formatY to label the axis in the data's own units (money/number).
 */
import { useId } from 'react'

const AXIS = 'rgba(255,255,255,.34)'
const GRID = 'rgba(255,255,255,.07)'
const PAD_L = 50          // left gutter for Y labels
const EMPTY = (h) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.2)', fontSize: 13 }}>No data</div>
)

// A short "nice" step so axis ticks land on round numbers.
function niceStep(raw) {
  if (raw <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / p
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return m * p
}
function buildTicks(max, count = 4) {
  if (!isFinite(max) || max <= 0) return [0, 1]
  const step = niceStep(max / count)
  const top = Math.ceil(max / step) * step
  const out = []
  for (let v = 0; v <= top + step * 1e-6; v += step) out.push(v)
  return out
}

// Monotone-cubic smoothing — a clean curve that never overshoots the data,
// so the filled area stays sane. pts are in the chart's own coordinate space.
function smoothPath(pts) {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (n === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  const dx = [], slope = []
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x || 1e-6; slope[i] = (pts[i + 1].y - pts[i].y) / dx[i] }
  const tan = new Array(n)
  tan[0] = slope[0]; tan[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) tan[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C ${pts[i].x + h} ${pts[i].y + tan[i] * h} ${pts[i + 1].x - h} ${pts[i + 1].y - tan[i + 1] * h} ${pts[i + 1].x} ${pts[i + 1].y}`
  }
  return d
}

// Y-axis labels + dashed gridlines, shared by line and bar charts.
function Grid({ ticks, top, height, formatY }) {
  return (
    <>
      {ticks.map((v, i) => {
        const y = height - (v / top) * height
        return (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: y, height: 0 }}>
            <div style={{ position: 'absolute', left: PAD_L, right: 0, borderTop: `1px ${i === 0 ? 'solid' : 'dashed'} ${GRID}` }} />
            <span style={{ position: 'absolute', left: 0, width: PAD_L - 10, textAlign: 'right', transform: 'translateY(-50%)', fontSize: 10, color: AXIS, whiteSpace: 'nowrap' }}>{formatY(v)}</span>
          </div>
        )
      })}
    </>
  )
}

function XLabels({ labels }) {
  const step = Math.ceil(labels.length / 9) || 1
  return (
    <div style={{ display: 'flex', marginLeft: PAD_L, marginTop: 7 }}>
      {labels.map((l, i) => (
        <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: AXIS, overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0 }}>{i % step === 0 ? l : ''}</span>
      ))}
    </div>
  )
}

export function LineChart({ labels = [], series, datasets, height = 200, formatY = v => v, showLegend = true }) {
  const uid = useId().replace(/[:]/g, '')
  const raw = (series || datasets || []).map(s => ({ label: s.label, color: s.color, data: s.data || s.values || [] }))
  const all = raw.flatMap(s => s.data)
  if (!all.length) return EMPTY(height)

  const max = Math.max(...all, 0)
  const min = Math.min(...all, 0)
  const ticks = buildTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const bottom = min < 0 ? min : 0
  const span = top - bottom || 1
  const W = 100, n = labels.length
  const xOf = i => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const yOf = v => height - ((v - bottom) / span) * height
  const zeroY = yOf(0)

  return (
    <div>
      <div style={{ position: 'relative', height }}>
        <Grid ticks={ticks} top={span} height={height} formatY={v => formatY(v + bottom)} />
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none"
          style={{ position: 'absolute', left: PAD_L, right: 0, top: 0, width: `calc(100% - ${PAD_L}px)`, height, overflow: 'visible' }}>
          <defs>
            {raw.map((s, i) => (
              <linearGradient key={i} id={`${uid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {raw.map((s, i) => {
            const pts = s.data.map((v, j) => ({ x: xOf(j), y: yOf(v) }))
            const line = smoothPath(pts)
            const area = `${line} L ${pts[pts.length - 1].x} ${zeroY} L ${pts[0].x} ${zeroY} Z`
            return (
              <g key={i}>
                <path d={area} fill={`url(#${uid}-g${i})`} stroke="none" />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </g>
            )
          })}
        </svg>
      </div>
      <XLabels labels={labels} />
      {showLegend && raw.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, marginLeft: PAD_L, flexWrap: 'wrap' }}>
          {raw.map((s, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,.6)' }}>
              <span style={{ width: 11, height: 3, borderRadius: 2, background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function BarChart({ labels = [], data = [], display = null, color = '#fbbf24', height = 180, formatY = v => v }) {
  const uid = useId().replace(/[:]/g, '')
  // Accept both [{label,value,display}] and parallel arrays.
  const bars = (data.length && typeof data[0] === 'object')
    ? data.map(d => ({ label: d.label, value: d.value || 0, display: d.display }))
    : data.map((v, i) => ({ label: labels[i] ?? '', value: v || 0, display: display ? display[i] : undefined }))

  if (!bars.length) return EMPTY(height)

  const max = Math.max(...bars.map(b => b.value), 0)
  const ticks = buildTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const many = bars.length > 24
  const barMax = many ? 16 : 44

  return (
    <div>
      <div style={{ position: 'relative', height }}>
        <Grid ticks={ticks} top={top} height={height} formatY={formatY} />
        <div style={{ position: 'absolute', left: PAD_L, right: 0, top: 0, height, display: 'flex', alignItems: 'flex-end', gap: many ? 2 : 6 }}>
          {bars.map((b, i) => (
            <div key={i} title={`${b.label}: ${b.display ?? b.value}`}
              style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100%' }}>
              <div style={{
                width: '78%', maxWidth: barMax,
                height: `${Math.max((b.value / top) * height, b.value > 0 ? 3 : 0)}px`,
                background: `linear-gradient(180deg, ${color}, ${color}aa)`,
                borderRadius: '6px 6px 2px 2px',
                boxShadow: `0 0 0 1px ${color}22`,
                transition: 'height .45s cubic-bezier(.2,.7,.3,1)',
              }} />
            </div>
          ))}
        </div>
      </div>
      <XLabels labels={bars.map(b => b.label)} />
    </div>
  )
}

export function Donut({ segments = [], size = 160, thickness = 24, centerLabel, centerSub, showLegend = true }) {
  const items = segments.filter(s => (s.value || 0) >= 0)
  const total = items.reduce((s, x) => s + (x.value || 0), 0)
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  let offset = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={thickness} />
            {total > 0 && items.map((s, i) => {
              if (!s.value) return null
              const len = (s.value / total) * C
              const gap = len > 4 ? 1.5 : 0   // tiny breathing room between slices
              const el = (
                <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(len - gap, 0.1)} ${C - Math.max(len - gap, 0.1)}`} strokeDashoffset={-offset}
                  style={{ transition: 'stroke-dasharray .5s ease' }} />
              )
              offset += len
              return el
            })}
          </g>
        </svg>
        {(centerLabel || centerSub) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {centerLabel && <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{centerLabel}</div>}
            {centerSub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{centerSub}</div>}
          </div>
        )}
      </div>
      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, flex: 1 }}>
          {items.map((s, i) => {
            const pct = total ? Math.round((s.value / total) * 100) : 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,.7)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{s.display ?? s.value}</span>
                <span style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, width: 34, textAlign: 'right' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
