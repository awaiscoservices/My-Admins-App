/**
 * TransactionList — ledger rows rendered the same card style the player sees
 * on their own Transactions page, so the Wallet Overview modal and the player
 * detail page read identically to the player's view. One comprehensive source
 * of truth for any "what happened on my account" question.
 *
 * Columns: Transaction (icon + label + full detail + ref) · Date · Status ·
 *          Balance After · Amount
 *
 * Rows are ledger entries ({ type, wallet_bucket, amount_cents, direction,
 * balance_after_cents, reference_id, description, created_at }). Everything in
 * the ledger has already settled, so the status is always Completed.
 */
import Icon from './ui/Icon'
import { typeLabel, typeColor, typeIcon } from '../lib/txMeta'

const fmt = c => '$' + (Math.abs(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
const fmtDate = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

const GRID = '2.2fr 1.3fr 1fr 1fr 1fr'

const STATUS_STYLE = {
  completed: { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  color: '#22c55e', label: 'Completed' },
  approved:  { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  color: '#22c55e', label: 'Completed' },
  paid:      { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  color: '#22c55e', label: 'Paid' },
  pending:   { bg: 'rgba(251,191,36,0.12)',border: 'rgba(251,191,36,0.35)',color: '#fbbf24', label: 'Pending' },
  under_review: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', color: '#3b82f6', label: 'Processing' },
  processing:{ bg: 'rgba(59,130,246,0.12)',border: 'rgba(59,130,246,0.35)',color: '#3b82f6', label: 'Processing' },
  rejected:  { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  color: '#ef4444', label: 'Rejected' },
  failed:    { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  color: '#ef4444', label: 'Failed' },
  cancelled: { bg: 'rgba(255,255,255,0.05)',border: 'rgba(255,255,255,0.1)',color: 'rgba(255,255,255,0.4)', label: 'Cancelled' },
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.completed
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
  )
}

export default function TransactionList({ rows }) {
  return (
    <>
      <style jsx global>{`
        @media (max-width: 640px) {
          .atx-head { display: none !important; }
          .atx-row { grid-template-columns: 1fr auto !important; row-gap: 4px !important; padding: 12px 14px !important; }
          .atx-sub { grid-column: 1 / -1; display: flex; gap: 10px; flex-wrap: wrap; }
        }
      `}</style>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
        {/* Header */}
        <div className="atx-head" style={{ display: 'grid', gridTemplateColumns: GRID, padding: '11px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <span>Transaction</span>
          <span>Date</span>
          <span>Status</span>
          <span>Balance After</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
        </div>
        {rows.map((row, i) => {
          const isCredit = row.direction ? row.direction === 'credit' : (row.amount_cents >= 0)
          const color = typeColor(row.type)
          const status = row.status || 'completed'
          const rejected = status === 'rejected' || status === 'failed'
          return (
            <div key={row.id || i} className="atx-row" style={{ display: 'grid', gridTemplateColumns: GRID, padding: '13px 18px', alignItems: 'center', borderTop: i ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {/* Transaction: icon + label + full detail + reference */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                  <Icon name={typeIcon(row.type)} size={17} color={color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {typeLabel(row.type)}
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: row.wallet_bucket === 'bonus' ? 'rgba(168,85,247,.15)' : 'rgba(255,255,255,.07)', color: row.wallet_bucket === 'bonus' ? '#a855f7' : 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>{row.wallet_bucket || 'cash'}</span>
                  </div>
                  {row.description && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{row.description}</div>}
                  {rejected && row.rejection_reason && <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.85)', marginTop: 2 }}>Reason: {row.rejection_reason}</div>}
                  {row.reference_id && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: 'monospace', marginTop: 1 }}>{row.reference_id}</div>}
                </div>
              </div>
              {/* Date */}
              <div className="atx-sub" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{fmtDate(row.created_at)}</div>
              {/* Status */}
              <div className="atx-sub"><StatusPill status={status} /></div>
              {/* Balance After */}
              <div className="atx-sub" style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>{row.balance_after_cents != null ? fmt(row.balance_after_cents) : '—'}</div>
              {/* Amount */}
              <div style={{ fontSize: 14, fontWeight: 800, color: isCredit ? '#22c55e' : '#ef4444', textAlign: 'right' }}>{isCredit ? '+' : '−'}{fmt(row.amount_cents)}</div>
            </div>
          )
        })}
      </div>
    </>
  )
}
