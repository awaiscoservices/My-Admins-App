/**
 * GET /api/superadmin/reports?report=&from=&to=&group_by=&shift=&tenant=
 *
 * Platform-wide reports for the Super Admin. Same response shape and the same
 * report set as the admin reports route, but NOT tenant-scoped: it rolls up
 * every casino at once, and every report also carries a per-casino breakdown
 * ("data of all admins with respect to each aspect") plus a Casino column on
 * the detail table. An optional `tenant` filter narrows to one casino.
 *
 * Super-admin only (guardSuperAdmin). SQL is never written here — the
 * service-role client does the querying.
 */
import { guardSuperAdmin, supabaseAdmin } from './_guard'
import { SETTLED } from '../../../lib/statuses'

function resolveRange(req) {
  const { from, to } = req.query
  const end = to ? new Date(to + 'T23:59:59.999') : new Date()
  let start
  if (from) start = new Date(from + 'T00:00:00')
  else { start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0) }
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

// The 3 operating shifts. Morning 12am–8am, Evening 8am–4pm, Night 4pm–12am.
function shiftOf(ts) {
  const h = new Date(ts).getHours()
  if (h < 8)  return { key: '1', label: 'Morning (12–8)' }
  if (h < 16) return { key: '2', label: 'Evening (8–4)' }
  return { key: '3', label: 'Night (4–12)' }
}
const shiftLabelOf = ts => shiftOf(ts).label
const SHIFT_BY_KEY = { '1': 'morning', '2': 'evening', '3': 'night' }
const shiftIdOf = ts => SHIFT_BY_KEY[shiftOf(ts).key]

function bucketOf(ts, gran) {
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

function breakdownBy(rows, field, amountField = 'amount_cents') {
  const map = new Map()
  for (const r of rows) {
    const key = r[field] || '—'
    const b = map.get(key) || { key, count: 0, amount_cents: 0 }
    b.count += 1
    b.amount_cents += (r[amountField] || 0)
    map.set(key, b)
  }
  return [...map.values()].sort((a, b) => (b.amount_cents - a.amount_cents) || (b.count - a.count))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const admin = await guardSuperAdmin(req, res)
  if (!admin) return

  const { startISO, endISO } = resolveRange(req)
  const gran = ['day', 'week', 'month'].includes(req.query.group_by) ? req.query.group_by : 'day'
  const report = req.query.report || 'overview'
  const tenantFilter = req.query.tenant?.trim() || ''
  const CAP = 20000

  const shift = ['morning', 'evening', 'night'].includes(req.query.shift) ? req.query.shift : 'all'
  const matchesShift = r => shift === 'all' || shiftIdOf(r.created_at) === shift

  const money = (label, cents) => ({ label, value: cents, money: true })
  const num   = (label, n) => ({ label, value: n })

  // One query helper: platform-wide, optionally narrowed to one casino and
  // always clipped to the date range.
  const base = (table, select) => {
    let query = supabaseAdmin.from(table).select(select)
      .gte('created_at', startISO).lte('created_at', endISO)
    if (tenantFilter) query = query.eq('tenant_id', tenantFilter)
    return query
  }

  try {
    // Casino name map — every row gets its casino name stamped on it.
    const { data: tenantsData } = await supabaseAdmin.from('tenants').select('id, name')
    const casinoOf = Object.fromEntries((tenantsData || []).map(t => [t.id, t.name || '—']))
    const nameTenant = r => ({ ...r, casino: casinoOf[r.tenant_id] || '—' })

    // Attach player names to rows that carry user_id (across all tenants).
    async function withPlayers(rows) {
      const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
      if (!ids.length) return rows
      const { data } = await supabaseAdmin.from('profiles').select('id, username, full_name').in('id', ids)
      const nameOf = Object.fromEntries((data || []).map(p => [p.id, p.username || p.full_name || '—']))
      return rows.map(r => ({ ...r, player: nameOf[r.user_id] || '—' }))
    }

    // ── OVERVIEW ──────────────────────────────────────────────────────────
    if (report === 'overview') {
      const [dep, wd, players] = await Promise.all([
        base('deposits', 'amount_cents, created_at, tenant_id, payment_methods ( name )').in('status', SETTLED.deposits).limit(CAP),
        base('withdrawals', 'amount_cents, created_at, tenant_id, method').in('status', SETTLED.withdrawals).limit(CAP),
        base('profiles', 'created_at, tenant_id').eq('role', 'player').limit(CAP),
      ])
      const depRows = (dep.data || []).filter(matchesShift).map(nameTenant)
      const wdRows = (wd.data || []).filter(matchesShift).map(nameTenant)
      const playerRows = (players.data || []).filter(matchesShift).map(nameTenant)
      const depTotal = depRows.reduce((s, r) => s + (r.amount_cents || 0), 0)
      const wdTotal  = wdRows.reduce((s, r) => s + (r.amount_cents || 0), 0)
      const depSeries = timeSeries(depRows, gran)
      const wdSeries  = timeSeries(wdRows, gran)
      const keys = [...new Set([...depSeries.map(b => b.key), ...wdSeries.map(b => b.key)])].sort()
      const labelFor = Object.fromEntries([...depSeries, ...wdSeries].map(b => [b.key, b.label]))
      const depMap = Object.fromEntries(depSeries.map(b => [b.key, b.amount]))
      const wdMap  = Object.fromEntries(wdSeries.map(b => [b.key, b.amount]))
      const labels = keys.map(k => labelFor[k])
      const depData = keys.map(k => depMap[k] || 0)
      const wdData  = keys.map(k => wdMap[k] || 0)

      // Per-casino rollup: deposits, withdraws, net and new players, one row
      // per casino. This is the "all admins, every aspect" table.
      const casinoKeys = [...new Set([...depRows, ...wdRows, ...playerRows].map(r => r.casino))]
      const depByTenant = Object.fromEntries(breakdownBy(depRows, 'casino').map(x => [x.key, x]))
      const wdByTenant  = Object.fromEntries(breakdownBy(wdRows, 'casino').map(x => [x.key, x]))
      const newByTenant = Object.fromEntries(breakdownBy(playerRows, 'casino').map(x => [x.key, x.count]))
      const tenantRows = casinoKeys.map(k => {
        const d = depByTenant[k]?.amount_cents || 0
        const w = wdByTenant[k]?.amount_cents || 0
        return {
          casino: k,
          deposits_cents: d,
          withdrawals_cents: w,
          net_cents: d - w,
          deposit_count: depByTenant[k]?.count || 0,
          withdraw_count: wdByTenant[k]?.count || 0,
          new_players: newByTenant[k] || 0,
        }
      }).sort((a, b) => b.deposits_cents - a.deposits_cents)

      return res.status(200).json({
        report, group_by: gran, range: { from: startISO, to: endISO },
        kpis: [
          num('Casinos', tenantsData?.length || 0),
          money('Deposits', depTotal),
          money('Withdraw', wdTotal),
          money('Net Revenue', depTotal - wdTotal),
          num('New Players', playerRows.length),
          num('Deposit Count', depRows.length),
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
            { key: 'Withdraw', count: wdRows.length, amount_cents: wdTotal },
          ],
        },
        // Deposit share per casino (bars in the By Casino panel).
        tenant_breakdown: { dimension: 'casino', items: breakdownBy(depRows, 'casino') },
        method_breakdowns: [
          { label: 'Deposits by Method', items: breakdownBy(depRows.map(r => ({ ...r, method: r.payment_methods?.name || '—' })), 'method') },
          { label: 'Withdraw by Method', items: breakdownBy(wdRows.map(r => ({ ...r, method: r.method || '—' })), 'method') },
        ],
        // Per-casino table — every casino, every money aspect.
        columns: [
          { key: 'casino', label: 'Casino', type: 'text' },
          { key: 'deposits_cents', label: 'Deposits', type: 'money' },
          { key: 'withdrawals_cents', label: 'Withdraw', type: 'money' },
          { key: 'net_cents', label: 'Net', type: 'money' },
          { key: 'deposit_count', label: 'Deposits #', type: 'num' },
          { key: 'withdraw_count', label: 'Withdraw #', type: 'num' },
          { key: 'new_players', label: 'New Players', type: 'num' },
        ],
        rows: tenantRows,
        total_count: tenantRows.length,
      })
    }

    // ── Generic single-table reports ──────────────────────────────────────
    const CONFIGS = {
      deposits: {
        table: 'deposits',
        select: 'id, reference_id, amount_cents, bonus_cents, status, created_at, user_id, tenant_id, payment_method_id, payment_methods ( name )',
        breakdown: 'method',
        kpis: (rows) => [
          money('Total Deposits', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          money('Bonus Given', rows.reduce((s, r) => s + (r.bonus_cents || 0), 0)),
          num('Count', rows.length),
          money('Avg', rows.length ? Math.round(rows.reduce((s, r) => s + (r.amount_cents || 0), 0) / rows.length) : 0),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'casino', label: 'Casino', type: 'text' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'method', label: 'Method', type: 'text' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'bonus_cents', label: 'Bonus', type: 'money' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      withdrawals: {
        table: 'withdrawals',
        select: 'id, reference_id, amount_cents, status, created_at, user_id, tenant_id, method',
        breakdown: 'method',
        kpis: (rows) => [
          money('Total Withdraw', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          num('Count', rows.length),
          money('Avg', rows.length ? Math.round(rows.reduce((s, r) => s + (r.amount_cents || 0), 0) / rows.length) : 0),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'casino', label: 'Casino', type: 'text' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'method', label: 'Method', type: 'text' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      redeems: {
        table: 'redemptions',
        select: 'id, reference_id, amount_cents, approved_cents, source_bucket, status, created_at, user_id, tenant_id',
        breakdown: 'status',
        kpis: (rows) => [
          money('Requested', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          money('Approved', rows.reduce((s, r) => s + (r.approved_cents || 0), 0)),
          num('Count', rows.length),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'casino', label: 'Casino', type: 'text' },
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
        select: 'id, reference_id, amount_cents, wallet_bucket, status, created_at, user_id, tenant_id',
        breakdown: 'status',
        kpis: (rows) => [
          money('Total Scored', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          num('Count', rows.length),
          money('Avg', rows.length ? Math.round(rows.reduce((s, r) => s + (r.amount_cents || 0), 0) / rows.length) : 0),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'casino', label: 'Casino', type: 'text' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'wallet_bucket', label: 'Wallet', type: 'badge' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      bonuses: {
        table: 'ledger',
        select: 'id, reference_id, type, amount_cents, wallet_bucket, created_at, user_id, tenant_id',
        filter: (query) => query.in('type', ['deposit_bonus', 'referral_bonus', 'bonus']),
        breakdown: 'type',
        kpis: (rows) => [
          money('Total Bonus', rows.reduce((s, r) => s + (r.amount_cents || 0), 0)),
          num('Entries', rows.length),
          num('Players', new Set(rows.map(r => r.user_id)).size),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'casino', label: 'Casino', type: 'text' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'type', label: 'Type', type: 'badge' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      transactions: {
        table: 'ledger',
        select: 'id, reference_id, type, amount_cents, wallet_bucket, created_at, user_id, tenant_id',
        breakdown: 'type',
        kpis: (rows) => [
          num('Entries', rows.length),
          num('Types', new Set(rows.map(r => r.type)).size),
          num('Players', new Set(rows.map(r => r.user_id)).size),
        ],
        columns: [
          { key: 'reference_id', label: 'Reference', type: 'ref' },
          { key: 'casino', label: 'Casino', type: 'text' },
          { key: 'player', label: 'Player', type: 'text' },
          { key: 'type', label: 'Type', type: 'badge' },
          { key: 'amount_cents', label: 'Amount', type: 'money' },
          { key: 'wallet_bucket', label: 'Wallet', type: 'badge' },
          { key: 'created_at', label: 'Date', type: 'date' },
        ],
      },
      players: {
        table: 'profiles',
        select: 'id, username, full_name, kyc_status, status, created_at, tenant_id',
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
          { key: 'casino', label: 'Casino', type: 'text' },
          { key: 'full_name', label: 'Name', type: 'text' },
          { key: 'kyc_status', label: 'KYC', type: 'badge' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'created_at', label: 'Joined', type: 'date' },
        ],
      },
    }

    const cfg = CONFIGS[report]
    if (!cfg) return res.status(400).json({ error: `Unknown report: ${report}` })

    let query = base(cfg.table, cfg.select).order('created_at', { ascending: false }).limit(CAP)
    if (cfg.filter) query = cfg.filter(query)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    let rows = (data || []).filter(matchesShift).map(nameTenant)
    if (!cfg.noPlayers) rows = await withPlayers(rows)
    rows = rows.map(r => ({
      ...r,
      method: r.method || r.payment_methods?.name || '—',
      shift: shiftLabelOf(r.created_at),
    }))

    const series = timeSeries(rows, gran)
    const breakdown = breakdownBy(rows, cfg.breakdown)
    const tenantBreakdown = breakdownBy(rows, 'casino')

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
      tenant_breakdown: { dimension: 'casino', items: tenantBreakdown },
      columns: cfg.columns,
      rows: rows.slice(0, 1000),
      total_count: rows.length,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Report failed' })
  }
}
