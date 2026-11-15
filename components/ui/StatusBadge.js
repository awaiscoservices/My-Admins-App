/**
 * StatusBadge — consistent status display across the platform
 * Usage: <StatusBadge status="pending" />
 */

const STATUS_CONFIG = {
  // Financial statuses
  pending:           { label: 'Pending',        bg: 'rgba(245,158,11,.15)',  color: '#f59e0b', dot: '#f59e0b' },
  under_review:      { label: 'Under Review',   bg: 'rgba(99,102,241,.15)',  color: '#94a3b8', dot: '#94a3b8' },
  processing:        { label: 'Processing',     bg: 'rgba(59,130,246,.15)',  color: '#60a5fa', dot: '#60a5fa' },
  approved:          { label: 'Approved',       bg: 'rgba(16,185,129,.15)', color: '#10b981', dot: '#10b981' },
  completed:         { label: 'Completed',      bg: 'rgba(16,185,129,.15)', color: '#10b981', dot: '#10b981' },
  paid:              { label: 'Paid',           bg: 'rgba(16,185,129,.15)', color: '#10b981', dot: '#10b981' },
  rejected:          { label: 'Rejected',       bg: 'rgba(239,68,68,.15)',  color: '#f87171', dot: '#f87171' },
  cancelled:         { label: 'Cancelled',      bg: 'rgba(107,114,128,.15)',color: '#9ca3af', dot: '#9ca3af' },
  failed:            { label: 'Failed',         bg: 'rgba(239,68,68,.15)',  color: '#f87171', dot: '#f87171' },
  reversed:          { label: 'Reversed',       bg: 'rgba(239,68,68,.15)',  color: '#f87171', dot: '#f87171' },

  // KYC statuses
  not_started:       { label: 'Not Started',    bg: 'rgba(107,114,128,.15)',color: '#9ca3af', dot: '#9ca3af' },
  verified:          { label: 'Verified',       bg: 'rgba(16,185,129,.15)', color: '#10b981', dot: '#10b981' },
  more_info_required:{ label: 'More Info',      bg: 'rgba(245,158,11,.15)', color: '#f59e0b', dot: '#f59e0b' },
  expired:           { label: 'Expired',        bg: 'rgba(239,68,68,.15)',  color: '#f87171', dot: '#f87171' },

  // Account statuses
  active:            { label: 'Active',         bg: 'rgba(16,185,129,.15)', color: '#10b981', dot: '#10b981' },
  suspended:         { label: 'Suspended',      bg: 'rgba(245,158,11,.15)', color: '#f59e0b', dot: '#f59e0b' },
  banned:            { label: 'Banned',         bg: 'rgba(239,68,68,.15)',  color: '#f87171', dot: '#f87171' },

  // Support
  open:              { label: 'Open',           bg: 'rgba(59,130,246,.15)', color: '#60a5fa', dot: '#60a5fa' },
  in_progress:       { label: 'In Progress',    bg: 'rgba(251,191,36,.15)', color: '#fbbf24', dot: '#fbbf24' },
  waiting_player:    { label: 'Waiting You',    bg: 'rgba(245,158,11,.15)', color: '#f59e0b', dot: '#f59e0b' },
  resolved:          { label: 'Resolved',       bg: 'rgba(16,185,129,.15)', color: '#10b981', dot: '#10b981' },
  closed:            { label: 'Closed',         bg: 'rgba(107,114,128,.15)',color: '#9ca3af', dot: '#9ca3af' },

  // Transaction / ledger types — the display names, never the raw keys
  // (never "Withdrawal"/"Redemption"/"Game Load").
  deposit:           { label: 'Deposit',         bg: 'rgba(16,185,129,.15)', color: '#10b981', dot: '#10b981' },
  deposit_bonus:     { label: 'Bonus',           bg: 'rgba(251,191,36,.15)', color: '#fbbf24', dot: '#fbbf24' },
  referral_bonus:    { label: 'Referral Bonus',  bg: 'rgba(168,85,247,.15)', color: '#a855f7', dot: '#a855f7' },
  bonus:             { label: 'Bonus',           bg: 'rgba(251,191,36,.15)', color: '#fbbf24', dot: '#fbbf24' },
  withdrawal:        { label: 'Withdraw',        bg: 'rgba(239,68,68,.15)',  color: '#f87171', dot: '#f87171' },
  withdrawal_refund: { label: 'Withdraw Refund', bg: 'rgba(239,68,68,.12)',  color: '#fca5a5', dot: '#fca5a5' },
  game_load:         { label: 'Scores',          bg: 'rgba(59,130,246,.15)', color: '#60a5fa', dot: '#60a5fa' },
  game_load_refund:  { label: 'Scores Refund',   bg: 'rgba(59,130,246,.12)', color: '#93c5fd', dot: '#93c5fd' },
  redeem:            { label: 'Redeem',          bg: 'rgba(16,185,129,.15)', color: '#10b981', dot: '#10b981' },
  adjustment:        { label: 'Adjustment',      bg: 'rgba(107,114,128,.15)',color: '#9ca3af', dot: '#9ca3af' },
}

export default function StatusBadge({ status, size = 'sm' }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status || 'Unknown',
    bg: 'rgba(107,114,128,.15)',
    color: '#9ca3af',
    dot: '#9ca3af',
  }

  const fontSize = size === 'xs' ? 10 : size === 'sm' ? 11 : 13

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: size === 'xs' ? '2px 7px' : '4px 10px',
      borderRadius: 99,
      background: cfg.bg,
      fontSize, fontWeight: 700,
      color: cfg.color,
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <span style={{
        width: size === 'xs' ? 5 : 6,
        height: size === 'xs' ? 5 : 6,
        borderRadius: '50%',
        background: cfg.dot,
        flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  )
}
