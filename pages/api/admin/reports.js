/**
 * GET /api/admin/reports?report=&from=&to=&group_by=
 *
 * Detailed, filterable reports for data analysis. One route, many reports,
 * all sharing a single response shape so the page can render any of them the
 * same way:
 *
 *   { report, group_by, range, kpis[], chart{labels,datasets}, breakdown,
 *     columns[], rows[], total_count }
 *
 * Everything is tenant-scoped through the admin guard. SQL is never written
 * here — the service-role client does the querying, same as the dashboard.
 */
import { guardAdmin, scopeToTenant, PERMS } from '../../../lib/adminGuard'
import { SETTLED } from '../../../lib/statuses'

const MS_DAY = 86400000

function resolveRange(req) {
  const { from, to } = req.query
  const end = to ? new Date(to + 'T23:59:59.999') : new Date()
  let start
  if (from) start = new Date(from + 'T00:00:00')
  else { start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0) }
  return { start, end, startISO: start.toISOString(), endISO: end.toISOString() }
}

// The 3 operating shifts. Morning 12am–8am, Evening 8am–4pm, Night 4pm–12am.
function shiftOf(ts) {
  const h = new Date(ts).getHours()
  if (h < 8)  return { key: '1', label: 'Morning (12–8)' }
  if (h < 16) return { key: '2', label: 'Evening (8–4)' }
  return { key: '3', label: 'Night (4–12)' }
}
const shiftLabelOf = ts => shiftOf(ts).label

// Chronological bucket key + label for a timestamp at the chosen granularity.
function bucketOf(ts, gran) {
  if (gran === 'shift') return shiftOf(ts)
  const d = new Date(ts)
  if (gran === 'month') {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }
  }
  if (gran === 'week') {
    const t = new Date(d); const dow = (t.getDay() + 6) % 7
    t.setDate(t.getDate() - dow); t.setHours(0, 0, 0, 0)
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    return { key, label: t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  }
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
}

// Turn rows into an ordered time series of { label, count, amount_cents }.
function timeSeries(rows, gran, amountField = 'amount_cents') {
  const map = new Map()
  for (const r of rows) {
    const { key, label } = bucketOf(r.created_at, gran)
    const b = map.get(key) || { key, label, count: 0, amount: 0 }
    b.count += 1
    b.amount += (r[amountField] || 0)
    map.set(key, b)
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

// Break rows down by a field (status / type / bucket), amount + count per key.
function breakdownBy(rows, field, amountField = 'amount_cents') {
  const map = new Map()
  for (const r of rows) {
    const key = r[field] || '—'
    const b = map.get(key) || { key, count: 0, amount_cents: 0 }
    b.count += 1
    b.amount_cents += (r[amountField] || 0)
    map.set(key, b)
  }
  return [...map.values()].sort((a, b) => b.amount_cents - a.amount_cents)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const gate = await guardAdmin(req, res, { allow: PERMS.ANALYTICS })
  if (!gate) return

  const q = (table, select) => scopeToTenant(gate.db.from(table).select(select), gate)
  const { start, end, startISO, endISO } = resolveRange(req)
  const inRange = (query) => query.gte('created_at', startISO).lte('created_at', endISO)
  const gran = ['day', 'week', 'month', 'shift'].includes(req.query.group_by) ? req.query.group_by : 'day'
  const report = req.query.report || 'overview'
  const CAP = 5000

  const money = (label, cents) => ({ label, value: cents, money: true })
  const num   = (label, n) => ({ label, value: n })

  // Attach player names to rows that carry user_id.
  async function withPlayers(rows) {
    const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
    if (!ids.length) return rows
    const { data } = await q('profiles', 'id, username, full_name').in('id', ids)
    const nameOf = Object.fromEntries((data || []).map(p => [p.id, p.username || p.full_name || '—']))
    return rows.map(r => ({ ...r, player: nameOf[r.user_id] || '—' }))
  }

  try {
    // ── OVERVIEW ──────────────────────────────────────────────────────────
    if (report === 'overview') {
      const [dep, wd, players] = await Promise.all([
        inRange(q('deposits', 'amount_cents, created_at').in('status', SETTLED.deposits)),
        inRange(q('withdrawals', 'amount_cents, created_at').in('status', SETTLED.withdrawals)),
        inRange(q('profiles', 'created_at').eq('role', 'player')),
      ])
      const depRows = dep.data || [], wdRows = wd.data || []
      const depTotal = depRows.reduce((s, r) => s + (r.amount_cents || 0), 0)
      const wdTotal  = wdRows.reduce((s, r) => s + (r.amount_cents || 0), 0)
      const depSeries = timeSeries(depRows, gran)
      const wdSeries  = timeSeries(wdRows, gran)
      // Union of labels across both series.
      const keys = [...new Set([...depSeries.map(b => b.key), ...wdSeries.map(b => b.key)])].sort()
      const labelFor = Object.fromEntries([...depSeries, ...wdSeries].map(b => [b.key, b.label]))
      const depMap = Object.fromEntries(depSeries.map(b => [b.key, b.amount]))
      const wdMap  = Object.fromEntries(wdSeries.map(b => [b.key, b.amount]))
      const labels = keys.map(k => labelFor[k])
      const depData = keys.map(k => depMap[k] || 0)
      const wdData  = keys.map(k => wdMap[k] || 0)
      return res.status(200).json({
        report, group_by: gran, range: { from: startISO, to: endISO },
        kpis: [
          money('Deposits', depTotal),
          money('Withdrawals', wdTotal),
          money('Net Revenue', depTotal - wdTotal),
          num('New Players', (players.data || []).length),
          num('Deposit Count', depRows.length),
          num('Withdraw Count', wdRows.length),
        ],
        chart: {
          type: 'line',
          labels,
          datasets: [
            { label: 'Deposits', color: '#22c55e', data: depData },
            { label: 'Withdraw', color: '#ef4444', data: wdData },
            { label: 'Net', color: '#fbbf24', data: keys.map((k, i) => depData[i] - wdData[i]) },
          ],
        },
        breakdown: {
          dimension: 'Flow',
          items: [
            { key: 'Deposits', count: depRows.length, amount_cents: depTotal },
            { key: 'Withdrawals', count: wdRows.length, amount_cents: wdTotal },
          ],
        },
        shift_breakdown: { dimension: 'shift', items: breakdownBy(depRows.map(r => ({ ...r, shift: shiftLabelOf(r.created_at) })), 'shift') },
        columns: [], rows: [], total_count: depRows.length + wdRows.length,
      })
    }

    // ── Generic single-table reports ──────────────────────────────────────
    const CONFIGS = {
      deposits: {
        table: 'deposits',
        select: 'id, reference_id, amount_cents, bonus_cents, status, created_at, user_id',
        breakdown: 'status',
        kpis: (rows) => [
          money('Total Deposits', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          money('Bonus Given', rows.reduce((s, r) => s + (r.bonus_cents || 0), 0)),
          num('Count', rows.length),
          money('Avg', rows.length ? Math.round(rows.reduce((s, r) => s + (r.amount_cents || 0), 0) / rows.length) : 0),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'bonus_cents', label: 'Bonus', type: 'money' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      withdrawals: {
        table: 'withdrawals',
        select: 'id, reference_id, amount_cents, status, created_at, user_id',
        breakdown: 'status',
        kpis: (rows) => [
          money('Total Withdraw', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          num('Count', rows.length),
          money('Avg', rows.length ? Math.round(rows.reduce((s, r) => s + (r.amount_cents || 0), 0) / rows.length) : 0),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      redeems: {
        table: 'redemptions',
        select: 'id, reference_id, amount_cents, approved_cents, source_bucket, status, created_at, user_id',
        breakdown: 'status',
        kpis: (rows) => [
          money('Requested', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          money('Approved', rows.reduce((s, r) => s + (r.approved_cents || 0), 0)),
          num('Count', rows.length),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'amount_cents', label: 'Requested', type: 'money' },
          { key: 'approved_cents', label: 'Approved', type: 'money' },
          { key: 'source_bucket', label: 'Wallet', type: 'badge' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      scores: {
        table: 'game_loads',
        select: 'id, reference_id, amount_cents, wallet_bucket, status, created_at, user_id',
        breakdown: 'status',
        kpis: (rows) => [
          money('Total Scored', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          num('Count', rows.length),
          money('Avg', rows.length ? Math.round(rows.reduce((s, r) => s + (r.amount_cents || 0), 0) / rows.length) : 0),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'wallet_bucket', label: 'Wallet', type: 'badge' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      bonuses: {
        table: 'ledger',
        select: 'id, reference_id, type, amount_cents, wallet_bucket, created_at, user_id',
        filter: (query) => query.in('type', ['deposit_bonus', 'referral_bonus', 'bonus']),
        breakdown: 'type',
        kpis: (rows) => [
          money('Total Bonus', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          num('Entries', rows.length),
          num('Players', new Set(rows.map(r => r.user_id)).size),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'type', label: 'Type', type: 'badge' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      transactions: {
        table: 'ledger',
        select: 'id, reference_id, type, amount_cents, wallet_bucket, created_at, user_id',
        breakdown: 'type',
        kpis: (rows) => [
          num('Entries', rows.length),
          num('Types', new Set(rows.map(r => r.type)).size),
          num('Players', new Set(rows.map(r => r.user_id)).size),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'type', label: 'Type', type: 'badge' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'wallet_bucket', label: 'Wallet', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      players: {
        table: 'profiles',
        select: 'id, username, full_name, kyc_status, status, created_at',
        filter: (query) => query.eq('role', 'player'),
        breakdown: 'kyc_status',
        noPlayers: true,
        kpis: (rows) => [
          num('New Players', rows.length),
          num('KYC Verified', rows.filter(r => r.kyc_status === 'verified').length),
          num('Suspended', rows.filter(r => r.status === 'suspended').length),
        ],
        columns: [
          { key: 'username', label: 'Username', type: 'text' },
          { key: 'full_name', label: 'Name', type: 'text' },
          { key: 'kyc_status', label: 'KYC', type: 'badge' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Joined', type: 'date' },
        ],
      },
    }

    const cfg = CONFIGS[report]
    if (!cfg) return res.status(400).json({ error: `Unknown report: ${report}` })

    let query = inRange(q(cfg.table, cfg.select)).order('created_at', { ascending: false }).limit(CAP)
    if (cfg.filter) query = cfg.filter(query)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    let rows = data || []
    if (!cfg.noPlayers) rows = await withPlayers(rows)
    // Tag every row with its shift, so the detail table and CSV carry it.
    rows = rows.map(r => ({ ...r, shift: shiftLabelOf(r.created_at) }))

    const series = timeSeries(rows, gran)
    const breakdown = breakdownBy(rows, cfg.breakdown)

    // Always available: a split by shift, whatever the chosen grouping.
    const shiftBreakdown = breakdownBy(rows, 'shift')

    // Add a Shift column right before the date column.
    const shiftCol = { key: 'shift', label: 'Shift', type: 'text' }
    const di = cfg.columns.findIndex(c => c.type === 'date')
    const columns = di === -1
      ? [...cfg.columns, shiftCol]
      : [...cfg.columns.slice(0, di), shiftCol, ...cfg.columns.slice(di)]

    return res.status(200).json({
      report, group_by: gran, range: { from: startISO, to: endISO },
      kpis: cfg.kpis(rows),
      chart: {
        type: 'bar',
        labels: series.map(b => b.label),
        datasets: [{ label: 'Amount', color: '#fbbf24', data: series.map(b => b.amount) }],
        counts: series.map(b => b.count),
      },
      breakdown: { dimension: cfg.breakdown, items: breakdown },
      shift_breakdown: { dimension: 'shift', items: shiftBreakdown },
      columns,
      rows: rows.slice(0, 1000),
      total_count: rows.length,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Report failed' })
  }
}
