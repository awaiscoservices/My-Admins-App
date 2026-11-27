/**
 * components/internal/InternalSupport.js
 *
 * The internal staff Support inbox, shared by /admin/support (tenant staff) and
 * /superadmin/support (platform owner). It mirrors the player Live Chat
 * (/admin/chat): same gold panels, conversation list, search + unread/starred
 * filters, star toggle, message bubbles, emoji picker and file attachments.
 *
 * Who sees what is decided server-side by /api/internal/* from the caller's
 * role — this component just renders whatever threads + contacts come back:
 *   • tenant staff : a "Platform Support" thread + 1:1 DMs with teammates
 *   • super admin  : one "Platform Support" thread per casino (whole platform)
 *
 * Pass `superadmin` only to tune copy (placeholder, empty states).
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../ui/Icon'

const GOLD   = '#fbbf24'
const SUBTLE = 'rgba(255,255,255,.45)'
const PANEL  = { background: 'linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018))', border: '1px solid rgba(251,191,36,.13)', borderRadius: 16 }

const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
const fmtAgo  = d => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return fmtDate(d)
}

async function apiFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(path, { ...opts, headers: { Authorization: `Bearer ${session?.access_token}`, ...(opts.headers ?? {}) } })
  return r.json()
}

function initials(label) {
  return String(label || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function StarIcon({ filled, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? GOLD : 'none'}
      stroke={filled ? GOLD : 'rgba(255,255,255,.45)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
    </svg>
  )
}
function PaperclipIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}
function Avatar({ label, size = 36 }) {
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: '50%', background: 'rgba(251,191,36,.14)', border: '1px solid rgba(251,191,36,.3)', color: GOLD, fontSize: size * 0.36, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit',sans-serif" }}>
      {initials(label)}
    </span>
  )
}

const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳','😅','😭','😉','😴','🤔','🙏','👍','👎','👌','🙌','👏','💪','👋','🤝','🔥','💯','✅','❌','⭐','🎉','🎁','💰','💵','🤑','🥰','😇','😳','🤗','😢','😡','❤️','💖','😬','🙈','🫶','😄','🤭','😤']
function EmojiButton({ onPick, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)} disabled={disabled} title="Emoji"
        style={{ width: 40, height: 40, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 268, background: '#0e1a2e', border: '1px solid rgba(251,191,36,.25)', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.6)', padding: 8, display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 2, zIndex: 30 }}>
          {EMOJIS.map(em => (
            <button key={em} type="button" onClick={() => { onPick(em); setOpen(false) }}
              style={{ background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1, padding: '5px 0', cursor: 'pointer', borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{em}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Bubble ───────────────────────────────────────────────────────────────────
// `mine` comes from the server (sender_id === me). On a platform thread, where
// several teammates share one side, show the sender's name above others' bubbles.
function Bubble({ msg, showSender }) {
  const isMe = msg.mine
  const isImage = msg.file_type?.startsWith('image/')
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{ maxWidth: '72%' }}>
        {!isMe && showSender && (
          <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, margin: '0 0 3px 4px' }}>
            {msg.sender_name}{msg.sender_role ? ` · ${String(msg.sender_role).replace(/_/g, ' ')}` : ''}
          </div>
        )}
        <div style={{
          padding: msg.file_url && !msg.body ? '6px' : '10px 14px',
          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isMe ? 'linear-gradient(135deg,#b45309,#92400e)' : 'rgba(255,255,255,.08)',
          border: isMe ? 'none' : '1px solid rgba(255,255,255,.1)',
          fontSize: 14, color: '#fff', lineHeight: 1.5, wordBreak: 'break-word',
        }}>
          {msg.file_url && isImage && (
            <a href={msg.file_url} target="_blank" rel="noreferrer">
              <img src={msg.file_url} alt={msg.file_name ?? 'image'} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, display: 'block', marginBottom: msg.body ? 8 : 0 }} />
            </a>
          )}
          {msg.file_url && !isImage && (
            <a href={msg.file_url} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', textDecoration: 'none', marginBottom: msg.body ? 8 : 0 }}>
              <PaperclipIcon size={16} />
              <span style={{ fontSize: 12, wordBreak: 'break-all' }}>{msg.file_name ?? 'Attachment'}</span>
            </a>
          )}
          {msg.body && <span>{msg.body}</span>}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>
            {fmtTime(msg.created_at)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function InternalSupport({ superadmin = false }) {
  const [threads, setThreads]   = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [body, setBody]         = useState('')
  const [sending, setSending]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')
  const bottomRef = useRef(null)
  const fileRef   = useRef(null)
  const inputRef  = useRef(null)
  const justOpenedRef = useRef(false)

  const loadInbox = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    const data = await apiFetch('/api/internal/conversations')
    setThreads(data.threads ?? [])
    setContacts(data.contacts ?? [])
    if (!quiet) setLoading(false)
  }, [])
  useEffect(() => { loadInbox() }, [loadInbox])

  const refreshMessages = useCallback(async (id) => {
    if (!id) return
    const data = await apiFetch(`/api/internal/messages?conversationId=${id}`)
    if (!Array.isArray(data.messages)) return
    setMessages(prev => {
      const b = prev[prev.length - 1], n = data.messages[data.messages.length - 1]
      const same = prev.length === data.messages.length && (!n || (b && b.id === n.id))
      return same ? prev : data.messages
    })
  }, [])

  // Realtime + 5s poll (RLS lets a participant receive their own rows).
  useEffect(() => {
    const ch = supabase.channel('internal-support-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages' },
        () => { loadInbox(true); refreshMessages(selected?.id) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_conversations' },
        () => loadInbox(true))
      .subscribe()
    const poll = setInterval(() => { loadInbox(true); refreshMessages(selected?.id) }, 5000)
    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [loadInbox, refreshMessages, selected?.id])

  const openMessages = useCallback(async (thread) => {
    setMsgLoading(true); setMessages([]); setError('')
    const data = await apiFetch(`/api/internal/messages?conversationId=${thread.id}`)
    justOpenedRef.current = true
    setMessages(data.messages ?? [])
    setMsgLoading(false)
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: 0 } : t))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('admin:support-opened'))
  }, [])

  const selectThread = useCallback((thread) => { setSelected(thread); openMessages(thread) }, [openMessages])

  // Start (or reopen) a thread from a contact row, then open it.
  const startContact = useCallback(async (contact) => {
    setError('')
    const payload = contact.type === 'platform'
      ? { kind: 'platform', tenantId: contact.tenantId }
      : { kind: 'dm', otherUserId: contact.userId }
    const data = await apiFetch('/api/internal/conversations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (data.error) { setError(data.error); return }
    const conv = data.conversation
    const thread = {
      id: conv.id, kind: conv.kind, tenant_id: conv.tenant_id,
      otherUserId: contact.userId ?? null, label: contact.label, sublabel: contact.sublabel,
      last_message: '', last_message_at: conv.last_message_at, unread: 0, is_starred: false,
    }
    setThreads(prev => prev.find(t => t.id === conv.id) ? prev : [thread, ...prev])
    selectThread(thread)
    loadInbox(true)
  }, [selectThread, loadInbox])

  useEffect(() => {
    if (!messages.length) return
    if (justOpenedRef.current) { bottomRef.current?.scrollIntoView(); justOpenedRef.current = false }
    else bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleStar = useCallback(async (thread) => {
    const next = !thread.is_starred
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, is_starred: next } : t))
    setSelected(prev => prev && prev.id === thread.id ? { ...prev, is_starred: next } : prev)
    const data = await apiFetch('/api/internal/conversations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: thread.id, is_starred: next }),
    })
    if (data?.error) {
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, is_starred: thread.is_starred } : t))
      setError(data.error)
    }
  }, [])

  async function handleSend(e) {
    e.preventDefault()
    if (!body.trim() || !selected || sending) return
    setSending(true); setError('')
    const data = await apiFetch('/api/internal/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selected.id, body: body.trim() }),
    })
    setSending(false)
    if (data.error) { setError(data.error); return }
    setBody('')
    setMessages(prev => prev.find(m => m.id === data.message.id) ? prev : [...prev, data.message])
    loadInbox(true)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !selected) return
    setUploading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch('/api/internal/upload', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` }, body: fd })
    const up = await r.json()
    if (up.error) { setError(up.error); setUploading(false); return }
    const data = await apiFetch('/api/internal/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selected.id, body: '', file: { url: up.url, name: up.name, type: up.type } }),
    })
    setUploading(false)
    if (data.error) { setError(data.error); return }
    setMessages(prev => prev.find(m => m.id === data.message.id) ? prev : [...prev, data.message])
    e.target.value = ''
  }

  // Filter + search the thread list.
  const unreadCount  = threads.filter(t => t.unread > 0).length
  const starredCount = threads.filter(t => t.is_starred).length
  let shownThreads = threads
  if (filter === 'unread')  shownThreads = shownThreads.filter(t => t.unread > 0)
  if (filter === 'starred') shownThreads = shownThreads.filter(t => t.is_starred)
  if (search.trim()) {
    const q = search.toLowerCase()
    shownThreads = shownThreads.filter(t => `${t.label} ${t.sublabel ?? ''}`.toLowerCase().includes(q))
  }
  const shownContacts = search.trim()
    ? contacts.filter(c => `${c.label} ${c.sublabel ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    : contacts

  const filterBox = (key, lbl, count) => {
    const active = filter === key
    return (
      <button type="button" onClick={() => setFilter(active ? 'all' : key)}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: "'Outfit',sans-serif", background: active ? 'rgba(251,191,36,.14)' : 'rgba(255,255,255,.05)', border: `1px solid ${active ? 'rgba(251,191,36,.5)' : 'rgba(255,255,255,.1)'}`, color: active ? GOLD : 'rgba(255,255,255,.65)' }}>
        {lbl}
        {count > 0 && <span style={{ background: active ? GOLD : 'rgba(255,255,255,.14)', color: active ? '#000' : 'rgba(255,255,255,.8)', borderRadius: 9, fontSize: 10, fontWeight: 800, padding: '1px 6px', minWidth: 16, textAlign: 'center' }}>{count}</span>}
      </button>
    )
  }

  const showSenderNames = selected?.kind === 'platform'

  return (
    <div style={{ boxSizing: 'border-box' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, height: 'calc(100vh - 104px)', minHeight: 420 }} className="is-grid">
        {/* Left: inbox */}
        <div style={{ ...PANEL, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <span style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              {superadmin ? 'Casinos' : 'Conversations'}
            </span>
          </div>

          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={superadmin ? 'Search casinos…' : 'Search people…'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {filterBox('unread', 'Unread', unreadCount)}
              {filterBox('starred', 'Starred', starredCount)}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>Loading…</div>}
            {!loading && !shownThreads.length && !shownContacts.length && (
              <div style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>
                {search || filter !== 'all' ? 'No matches' : 'Nothing here yet'}
              </div>
            )}

            {shownThreads.map(t => {
              const isActive = selected?.id === t.id
              const preview = t.last_message ? (t.last_from_me ? `You: ${t.last_message}` : t.last_message) : ''
              return (
                <div key={t.id} onClick={() => selectThread(t)}
                  style={{ padding: '12px 14px', background: isActive ? 'rgba(251,191,36,.1)' : (t.is_starred ? 'rgba(251,191,36,.04)' : 'transparent'), borderLeft: isActive ? `3px solid ${GOLD}` : (t.is_starred ? `3px solid ${GOLD}66` : '3px solid transparent'), cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <Avatar label={t.label} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span role="button" title={t.is_starred ? 'Unstar' : 'Star'} onClick={e => { e.stopPropagation(); toggleStar(t) }} style={{ flexShrink: 0, cursor: 'pointer', display: 'inline-flex' }}>
                          <StarIcon filled={!!t.is_starred} size={14} />
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
                      </span>
                      <span style={{ fontSize: 11, color: SUBTLE, flexShrink: 0 }}>{fmtAgo(t.last_message_at)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 12.5, color: t.unread > 0 ? 'rgba(255,255,255,.85)' : SUBTLE, fontWeight: t.unread > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {preview || t.sublabel || 'No messages yet'}
                      </span>
                      {t.unread > 0 && <span style={{ background: GOLD, color: '#000', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 7px', minWidth: 18, textAlign: 'center', flexShrink: 0 }}>{t.unread}</span>}
                    </div>
                  </div>
                </div>
              )
            })}

            {!!shownContacts.length && (
              <>
                <div style={{ padding: '12px 16px 6px', fontSize: 10.5, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: SUBTLE }}>
                  {superadmin ? 'Casinos without a thread' : 'Start a conversation'}
                </div>
                {shownContacts.map((c, i) => (
                  <div key={c.userId || c.tenantId || i} onClick={() => startContact(c)}
                    style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Avatar label={c.label} size={32} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
                      {c.sublabel && <div style={{ fontSize: 11.5, color: SUBTLE }}>{c.sublabel}</div>}
                    </div>
                    <Icon name="plus" size={15} style={{ color: GOLD, flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right: thread */}
        <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTLE, fontSize: 14 }}>
              Select a conversation to start
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar label={selected.label} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.label}</div>
                    {selected.sublabel && <div style={{ fontSize: 11.5, color: SUBTLE }}>{selected.sublabel}</div>}
                  </div>
                </div>
                <button onClick={() => toggleStar(selected)} title={selected.is_starred ? 'Unstar' : 'Star'}
                  style={{ flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selected.is_starred ? 'rgba(251,191,36,.14)' : 'rgba(255,255,255,.06)', border: `1px solid ${selected.is_starred ? 'rgba(251,191,36,.4)' : 'rgba(255,255,255,.14)'}`, borderRadius: 9, cursor: 'pointer' }}>
                  <StarIcon filled={!!selected.is_starred} size={16} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {msgLoading && <div style={{ textAlign: 'center', color: SUBTLE, fontSize: 13, padding: 20 }}>Loading…</div>}
                {!msgLoading && !messages.length && <div style={{ textAlign: 'center', color: SUBTLE, fontSize: 13, padding: 20 }}>No messages yet — say hello.</div>}
                {messages.map(m => <Bubble key={m.id} msg={m} showSender={showSenderNames} />)}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} style={{ position: 'relative', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', gap: 8, alignItems: 'center' }}>
                {error && (
                  <div style={{ position: 'absolute', bottom: 70, left: 20, right: 20, padding: '8px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 12 }}>{error}</div>
                )}
                <input ref={fileRef} type="file" accept="image/*,.pdf,.txt" style={{ display: 'none' }} onChange={handleFile} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title="Attach file"
                  style={{ flexShrink: 0, width: 40, height: 40, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: uploading ? SUBTLE : 'rgba(255,255,255,.75)', cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {uploading ? '…' : <PaperclipIcon />}
                </button>
                <EmojiButton disabled={sending} onPick={em => { setBody(b => b + em); inputRef.current?.focus() }} />
                <input ref={inputRef} value={body} onChange={e => setBody(e.target.value)} placeholder="Type a message…" maxLength={2000} disabled={sending}
                  style={{ flex: 1, padding: '11px 16px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: '#fff', fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none' }} />
                <button type="submit" disabled={!body.trim() || sending}
                  style={{ padding: '11px 22px', background: body.trim() ? `linear-gradient(135deg,${GOLD},#f59e0b)` : 'rgba(255,255,255,.08)', border: 'none', borderRadius: 12, color: body.trim() ? '#000' : SUBTLE, fontWeight: 800, fontSize: 14, cursor: body.trim() ? 'pointer' : 'default', fontFamily: "'Outfit',sans-serif" }}>
                  {sending ? '…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 860px){ .is-grid{ grid-template-columns: 1fr !important; height:auto !important; } }`}</style>
    </div>
  )
}
