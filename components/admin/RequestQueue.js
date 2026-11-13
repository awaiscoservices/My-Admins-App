import { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import { adminFetch } from '../../lib/adminFetch'
import AdminLayout from '../layout/AdminLayout'
import StatusBadge from '../ui/StatusBadge'
import { centsToDisplay } from '../ui/MoneyDisplay'
import Icon from '../ui/Icon'

const G = '#fbbf24'
const fmt = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// What each queue shows and which buttons it offers
const KINDS = {
  game_loads: {
    title: 'Game Loads', sub: 'Load the credits into the player’s game account, then mark it loaded.',
    amount: r => r.amount_cents,
    fields: r => [['Game', r._game?.name], ['Game username', r._game?.username]],
    ok: { id: 'completed', label: 'Mark loaded' }, canReject: true,
  },
  redemptions: {
    title: 'Redeem', sub: 'Approve to credit the amount to the player’s wallet. You can change the amount.',
    amount: r => r.amount_cents, amountInput: true,
    fields: r => [['Game', r._game?.name], ['Game username', r._game?.username], ['Player note', r.player_notes]],
    ok: { id: 'completed', label: 'Approve & credit wallet' }, canReject: true,
  },
  withdrawals: {
    title: 'Withdraw', sub: 'Send the money to the player first, then mark it paid.',
    amount: r => r.amount_cents, refInput: true,
    fields: r => [['Method', r.method], ['Pay to', r.destination], ['Payout reference', r.payout_reference]],
    ok: { id: 'completed', label: 'Mark paid' }, canReject: true,
  },
  kyc: {
    title: 'KYC Review', sub: 'Check the ID photos against the details, then verify or reject.',
    fields: r => [['Legal name', r.full_legal_name], ['Date of birth', r.dob], ['Address', r.address], ['ID', [r.id_type, r.id_number].filter(Boolean).join(' · ')]],
    docs: true, ok: { id: 'verified', label: 'Verify' }, canReject: true,
    extra: { id: 'more_info_required', label: 'Ask for more info', needsReason: true },
  },
  support: {
    title: 'Support Tickets', sub: 'Reply to the player and resolve the ticket.',
    fields: r => [['Category', r.category], ['Subject', r.subject]],
    message: r => r.message, replyBox: true,
    ok: { id: 'resolved', label: 'Reply & resolve', needsReason: true },
    extra: { id: 'in_progress', label: 'Mark in progress' },
  },
}
const OPEN = ['pending', 'under_review', 'processing', 'open', 'in_progress', 'waiting_player']

const btn = (bg, color, border) => ({ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', background: bg, color, border: border || 'none' })
const input = { width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none' }

function Row({ kind, cfg, r, onAct }) {
  const [text, setText] = useState('')       // reason / reply
  const [ref, setRef] = useState('')
  const [amt, setAmt] = useState(cfg.amountInput ? (r.amount_cents / 100).toFixed(2) : '')
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const isOpen = OPEN.includes(r.status)

  async function go(action, needsText) {
    setErr('')
    if (needsText && !text.trim()) return setErr(kind === 'support' ? 'Write a reply first' : 'Please write a reason')
    const body = { kind, id: r.id, action, reason: text }
    if (cfg.amountInput && action === 'completed') {
      const c = Math.round(parseFloat(amt) * 100)
      if (!c || c <= 0) return setErr('Enter a valid amount')
      body.amount_cents = c
    }
    if (cfg.refInput && action === 'completed') body.reference = ref
    setBusy(action)
    const e = await onAct(body)
    setBusy(null)
    if (e) setErr(e)
  }

  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(251,191,36,.14)', borderRadius: 16, padding: 18, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{r._player?.name || 'Unknown player'}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', wordBreak: 'break-all' }}>
            {[r._player?.email, r._player?.phone].filter(Boolean).join(' · ') || r.user_id} · {fmt(r.created_at)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {cfg.amount && <div style={{ fontSize: 22, fontWeight: 800, color: G }}>{centsToDisplay(cfg.amount(r))}</div>}
          <StatusBadge status={r.status} size="xs" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(200px,100%),1fr))', gap: 10, marginBottom: 12 }}>
        {cfg.fields(r).filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '8px 12px', minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>{k}</div>
            <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{v}</div>
          </div>
        ))}
      </div>

      {cfg.message && <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cfg.message(r)}</div>}
      {r.admin_reply && <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}><b style={{ color: G }}>Your reply:</b> {r.admin_reply}</div>}
      {r.rejection_reason && <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>Reason: {r.rejection_reason}</div>}

      {cfg.docs && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {r._docs?.front ? <a href={r._docs.front} target="_blank" rel="noreferrer" style={{ ...btn('rgba(251,191,36,.12)', G, '1px solid rgba(251,191,36,.35)'), textDecoration: 'none' }}><Icon name="image" size={13} style={{ verticalAlign:'-2px', marginRight:5 }} /> ID front</a> : <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>No front photo</span>}
          {r._docs?.back && <a href={r._docs.back} target="_blank" rel="noreferrer" style={{ ...btn('rgba(251,191,36,.12)', G, '1px solid rgba(251,191,36,.35)'), textDecoration: 'none' }}><Icon name="image" size={13} style={{ verticalAlign:'-2px', marginRight:5 }} /> ID back</a>}
        </div>
      )}

      {isOpen && (
        <div>
          {cfg.amountInput && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>Amount to credit (USD)</div><input type="number" step="0.01" min="0.01" value={amt} onChange={e => setAmt(e.target.value)} style={{ ...input, maxWidth: 200 }} /></div>}
          {cfg.refInput && <div style={{ marginBottom: 10 }}><input value={ref} onChange={e => setRef(e.target.value)} placeholder="Payment reference / transaction ID (optional)" style={input} /></div>}
          {(cfg.replyBox || rejecting || cfg.extra?.needsReason) && (
            <textarea rows={cfg.replyBox ? 3 : 2} value={text} onChange={e => setText(e.target.value)} style={{ ...input, marginBottom: 10, resize: 'vertical' }}
              placeholder={cfg.replyBox ? 'Write your reply to the player…' : 'Reason (shown to the player)…'} />
          )}
          {err && <div style={{ color: '#f87171', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button disabled={!!busy} onClick={() => go(cfg.ok.id, cfg.ok.needsReason)} style={{ ...btn('linear-gradient(135deg,#fbbf24,#f59e0b)', '#050505'), opacity: busy ? .5 : 1 }}>{busy === cfg.ok.id ? 'Working…' : cfg.ok.label}</button>
            {cfg.extra && <button disabled={!!busy} onClick={() => go(cfg.extra.id, cfg.extra.needsReason)} style={btn('transparent', G, '1px solid rgba(251,191,36,.4)')}>{cfg.extra.label}</button>}
            {cfg.canReject && (rejecting
              ? <button disabled={!!busy} onClick={() => go('rejected', true)} style={btn('rgba(239,68,68,.15)', '#f87171', '1px solid rgba(239,68,68,.4)')}>{busy === 'rejected' ? 'Working…' : 'Confirm reject'}</button>
              : <button disabled={!!busy} onClick={() => setRejecting(true)} style={btn('rgba(239,68,68,.08)', '#f87171', '1px solid rgba(239,68,68,.3)')}><Icon name="x" size={13} stroke={2.6} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Reject</button>)}
            {kind !== 'kyc' && kind !== 'support' && r.status === 'pending' && <button disabled={!!busy} onClick={() => go('under_review', false)} style={btn('transparent', 'rgba(255,255,255,.6)', '1px solid rgba(255,255,255,.2)')}>Mark under review</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function RequestQueue({ kind }) {
  const cfg = KINDS[kind]
  const [view, setView] = useState('open')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [loadErr, setLoadErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setLoadErr('')
    const r = await adminFetch(`/api/admin/queue?kind=${kind}&view=${view}`)
    if (!r.ok) setLoadErr(r.error); else setRows(r.data.rows || [])
    setLoading(false)
  }, [kind, view])
  useEffect(() => { load() }, [load])

  async function act(body) {
    const r = await adminFetch('/api/admin/requests/action', { method: 'POST', body })
    if (!r.ok) return r.error || 'Action failed'
    setToast(r.data.message); setTimeout(() => setToast(null), 3500)
    load()
    return null
  }

  return (
    <AdminLayout>
      <Head><title>{cfg.title} — Admin</title></Head>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'clamp(22px,3vw,28px)', fontWeight: 800, marginBottom: 4 }}>{cfg.title}</h1>
        <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 14 }}>{cfg.sub}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['open', 'Needs action'], ['done', 'Processed'], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{ ...btn(view === v ? G : 'transparent', view === v ? '#050505' : 'rgba(255,255,255,.7)', `1px solid ${view === v ? G : 'rgba(255,255,255,.15)'}`), borderRadius: 99 }}>{l}</button>
        ))}
        <button onClick={load} style={{ ...btn('transparent', 'rgba(255,255,255,.6)', '1px solid rgba(255,255,255,.15)'), borderRadius: 99 }}>↻ Refresh</button>
      </div>
      {toast && <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.35)', color: '#10b981', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 14 }}><Icon name="check" size={13} stroke={2.6} style={{ verticalAlign: '-2px', marginRight: 5 }} /> {toast}</div>}
      {loadErr && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#f87171', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{loadErr}</div>}
      {loading ? <div style={{ color: 'rgba(255,255,255,.4)', padding: 30, textAlign: 'center' }}>Loading…</div>
        : rows.length === 0 && !loadErr ? <div style={{ color: 'rgba(255,255,255,.35)', padding: 40, textAlign: 'center' }}><div style={{ display:'flex', justifyContent:'center', marginBottom:8, color:'#10b981' }}><Icon name="checkCircle" size={30} /></div>Nothing here</div>
        : rows.map(r => <Row key={r.id} kind={kind} cfg={cfg} r={r} onAct={act} />)}
    </AdminLayout>
  )
}
