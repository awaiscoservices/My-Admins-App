/**
 * /admin/chat — Staff chat inbox
 * Changes from previous version:
 *   - Search bar filters conversation list by player name/email
 *   - File attachment button (📎) uploads via /api/admin/chat/upload
 *   - Bubble renders image preview or file download link
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'
import PlayerWalletModal from '../../components/PlayerWalletModal'

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
  const r = await fetch(path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      ...(opts.headers ?? {}),
    },
  })
  return r.json()
}

const PANEL  = { background: 'linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018))', border: '1px solid rgba(251,191,36,.13)', borderRadius: 16 }
const GOLD   = '#fbbf24'
const SUBTLE = 'rgba(255,255,255,.45)'

// ─── ConversationList ─────────────────────────────────────────────────────────
function ConversationList({ convs, selected, onSelect, loading, search, onSearch }) {
  const filtered = search.trim()
    ? convs.filter(c => {
        const p = c.player ?? {}
        const hay = `${p.full_name ?? ''} ${p.username ?? ''} ${p.email ?? ''}`.toLowerCase()
        return hay.includes(search.toLowerCase())
      })
    : convs

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search players…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '8px 12px', background: 'rgba(255,255,255,.07)',
            border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
            color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none',
          }}
        />
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && <div style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>Loading…</div>}
        {!loading && !filtered.length && (
          <div style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>
            {search ? 'No matches' : 'No open conversations'}
          </div>
        )}
        {filtered.map(c => {
          const name = c.player?.full_name || c.player?.username || c.player?.email || 'Player'
          const isActive = selected?.id === c.id
          return (
            <button key={c.id} onClick={() => onSelect(c)}
              style={{
                width: '100%', textAlign: 'left', padding: '14px 16px',
                background: isActive ? 'rgba(251,191,36,.1)' : 'transparent',
                borderLeft: isActive ? `3px solid ${GOLD}` : '3px solid transparent',
                border: 'none', cursor: 'pointer', display: 'block',
                borderBottom: '1px solid rgba(255,255,255,.06)',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{name}</span>
                <span style={{ fontSize: 11, color: SUBTLE }}>{fmtAgo(c.last_message_at)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: SUBTLE }}>{c.player?.email || ''}</span>
                {c.unread > 0 && (
                  <span style={{ background: GOLD, color: '#000', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>
                    {c.unread}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Clean paperclip glyph (replaces the flat 📎 emoji).
function PaperclipIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

// WhatsApp-style ticks: grey ✓✓ = delivered, blue ✓✓ = seen (read_at set).
function Ticks({ read }) {
  return (
    <span style={{ marginLeft: 5, fontSize: 11, letterSpacing: '-3px', color: read ? '#53bdeb' : 'rgba(255,255,255,.55)' }}>
      ✓✓
    </span>
  )
}

// ─── Bubble ───────────────────────────────────────────────────────────────────
function Bubble({ msg, myId }) {
  const isMe = msg.sender_id === myId || msg.sender_type === 'staff'
  const isImage = msg.file_type?.startsWith('image/')
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '72%', padding: msg.file_url && !msg.body ? '6px' : '10px 14px',
        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isMe ? 'linear-gradient(135deg,#b45309,#92400e)' : 'rgba(255,255,255,.08)',
        border: isMe ? 'none' : '1px solid rgba(255,255,255,.1)',
        fontSize: 14, color: '#fff', lineHeight: 1.5, wordBreak: 'break-word',
      }}>
        {/* File / image attachment */}
        {msg.file_url && isImage && (
          <a href={msg.file_url} target="_blank" rel="noreferrer">
            <img src={msg.file_url} alt={msg.file_name ?? 'image'}
              style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, display: 'block', marginBottom: msg.body ? 8 : 0 }} />
          </a>
        )}
        {msg.file_url && !isImage && (
          <a href={msg.file_url} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,.1)', borderRadius: 10, color: '#fff', textDecoration: 'none', marginBottom: msg.body ? 8 : 0 }}>
            <PaperclipIcon size={16} />
            <span style={{ fontSize: 12, wordBreak: 'break-all' }}>{msg.file_name ?? 'Attachment'}</span>
          </a>
        )}
        {/* Text body */}
        {msg.body && <span>{msg.body}</span>}
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>
          {fmtTime(msg.created_at)}
          {isMe && <Ticks read={!!msg.read_at} />}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminChat() {
  const [convs, setConvs]           = useState([])
  const [convLoading, setConvLoading] = useState(true)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(null)
  const [messages, setMessages]     = useState([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [body, setBody]             = useState('')
  const [sending, setSending]       = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [error, setError]           = useState('')
  const [myId, setMyId]             = useState(null)
  const [walletFor, setWalletFor]   = useState(null)
  const [canned, setCanned]         = useState([])        // [{ key, text }]
  const [showCanned, setShowCanned] = useState(false)     // the "/" picker
  const [manageCanned, setManageCanned] = useState(false) // the editor modal
  const bottomRef                   = useRef(null)
  const channelRef                  = useRef(null)
  const inputRef                    = useRef(null)
  const fileRef                     = useRef(null)

  // Saved replies for this casino.
  const loadCanned = useCallback(async () => {
    const data = await apiFetch('/api/admin/chat/canned')
    setCanned(Array.isArray(data.replies) ? data.replies : [])
  }, [])
  useEffect(() => { loadCanned() }, [loadCanned])

  // The replies the current "/text" matches, for the picker.
  const cannedMatches = (() => {
    if (!body.startsWith('/')) return []
    const q = body.slice(1).toLowerCase()
    return canned.filter(r => r.key.includes(q) || r.text.toLowerCase().includes(q)).slice(0, 6)
  })()

  function applyCanned(reply) {
    setBody(reply.text)
    setShowCanned(false)
    inputRef.current?.focus()
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMyId(session?.user?.id ?? null)
    })
  }, [])

  const loadConvs = useCallback(async () => {
    setConvLoading(true)
    const data = await apiFetch('/api/admin/chat/conversations?status=open')
    setConvs(data.conversations ?? [])
    setConvLoading(false)
  }, [])

  // Quiet refresh — no "Loading…" flash. Used by polling + realtime so the
  // list picks up new chats and new messages without a hard refresh.
  const refreshConvs = useCallback(async (selectedId) => {
    const data = await apiFetch('/api/admin/chat/conversations?status=open')
    setConvs(prev => {
      const next = data.conversations ?? []
      // Keep the open thread's unread at 0 — we're looking at it.
      return selectedId ? next.map(c => c.id === selectedId ? { ...c, unread: 0 } : c) : next
    })
  }, [])

  useEffect(() => { loadConvs() }, [loadConvs])

  // Auto-refresh the conversation list: realtime on any new message or new
  // conversation for this casino, plus a slow poll as a safety net.
  useEffect(() => {
    const ch = supabase.channel('admin-chat-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' },
        () => refreshConvs(selected?.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' },
        () => refreshConvs(selected?.id))
      .subscribe()
    const poll = setInterval(() => refreshConvs(selected?.id), 10000)
    return () => { supabase.removeChannel(ch); clearInterval(poll) }
  }, [refreshConvs, selected?.id])

  const loadMessages = useCallback(async (conv) => {
    setMsgLoading(true)
    setMessages([])
    const data = await apiFetch(`/api/admin/chat/messages?conversationId=${conv.id}`)
    setMessages(data.messages ?? [])
    setMsgLoading(false)
    setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c))
  }, [])

  const handleSelect = useCallback((conv) => {
    setSelected(conv)
    setError('')
    loadMessages(conv)
  }, [loadMessages])

  useEffect(() => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    if (!selected) return
    const ch = supabase.channel(`admin-chat-${selected.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${selected.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            // read_at flips when the player opens the thread — turn ticks blue.
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
            return
          }
          setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          setConvs(prev => prev.map(c => c.id === selected.id ? { ...c, last_message_at: payload.new.created_at } : c))
        })
      .subscribe()
    channelRef.current = ch
    return () => { supabase.removeChannel(ch); channelRef.current = null }
  }, [selected?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if ((!body.trim() && !pendingFile.current) || !selected || sending) return
    setSending(true)
    setError('')
    const data = await apiFetch('/api/admin/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selected.id, body: body.trim() }),
    })
    setSending(false)
    if (data.error) { setError(data.error); return }
    setBody('')
    setMessages(prev => prev.find(m => m.id === data.message.id) ? prev : [...prev, data.message])
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || !selected) return
    setUploading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/admin/chat/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: fd,
    })
    const up = await r.json()
    if (up.error) { setError(up.error); setUploading(false); return }

    // Send a message that is just the attachment (empty body is allowed for attachments)
    const data = await apiFetch('/api/admin/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selected.id,
        body: '',
        fileUrl: up.url,
        fileName: up.name,
        fileType: up.type,
      }),
    })
    setUploading(false)
    if (data.error) { setError(data.error); return }
    setMessages(prev => prev.find(m => m.id === data.message.id) ? prev : [...prev, data.message])
    e.target.value = ''
  }

  const pendingFile = useRef(null)

  async function closeConversation() {
    if (!selected) return
    const data = await apiFetch('/api/admin/chat/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selected.id, status: 'closed' }),
    })
    if (data.error) { setError(data.error); return }
    setConvs(prev => prev.filter(c => c.id !== selected.id))
    setSelected(null)
  }

  return (
    <AdminLayout title="Chat">
      <Head><title>Chat — Casinoze Support</title></Head>
      <div style={{ boxSizing: 'border-box' }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 20 }}>
          Live Chat
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, height: 'calc(100vh - 180px)', minHeight: 360 }}>
          {/* Left */}
          <div style={{ ...PANEL, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                Conversations
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <ConversationList
                convs={convs} selected={selected} onSelect={handleSelect}
                loading={convLoading} search={search} onSearch={setSearch}
              />
            </div>
          </div>

          {/* Right */}
          <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTLE, fontSize: 14 }}>
                Select a conversation to start
              </div>
            ) : (
              <>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                      {selected.player?.full_name || selected.player?.email || 'Player'}
                    </div>
                    <div style={{ fontSize: 11, color: SUBTLE }}>{selected.player?.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* The player's balances and history, without leaving the
                        chat — staff often need them to answer a question. */}
                    <button onClick={() => setWalletFor(selected)}
                      style={{ padding: '6px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 9, color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                      Wallet
                    </button>
                    {/* Close (resolve) this conversation and clear it from the list. */}
                    <button onClick={closeConversation} title="Close conversation"
                      style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.28)', borderRadius: 9, color: '#f87171', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {msgLoading && <div style={{ textAlign: 'center', color: SUBTLE, fontSize: 13, padding: 20 }}>Loading…</div>}
                  {!msgLoading && messages.length === 0 && <div style={{ textAlign: 'center', color: SUBTLE, fontSize: 13, padding: 20 }}>No messages yet</div>}
                  {messages.map(m => <Bubble key={m.id} msg={m} myId={myId} />)}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} style={{ position: 'relative', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {error && (
                    <div style={{ position: 'absolute', bottom: 70, left: 20, right: 20, padding: '8px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 12 }}>
                      {error}
                    </div>
                  )}
                  {/* Saved-reply picker. Opens when the box starts with "/".
                      Click one, or press Enter when the key matches exactly,
                      and the whole message drops into the box. */}
                  {showCanned && cannedMatches.length > 0 && (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 16, right: 16, background: '#0e1a2e', border: '1px solid rgba(251,191,36,.25)', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.6)', overflow: 'hidden', zIndex: 20, maxHeight: 240, overflowY: 'auto' }}>
                      {cannedMatches.map(r => (
                        <button key={r.key} type="button" onClick={() => applyCanned(r)}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ color: GOLD, fontSize: 12, fontWeight: 800, fontFamily: 'monospace' }}>/{r.key}</div>
                          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* File picker */}
                  <input ref={fileRef} type="file" accept="image/*,.pdf,.txt" style={{ display: 'none' }} onChange={handleFile} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    title="Attach file"
                    style={{ flexShrink: 0, width: 40, height: 40, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: uploading ? SUBTLE : 'rgba(255,255,255,.75)', cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {uploading ? '…' : <PaperclipIcon />}
                  </button>

                  <button type="button" onClick={() => setManageCanned(true)} title="Saved replies"
                    style={{ flexShrink: 0, width: 40, height: 40, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: 'rgba(255,255,255,.6)', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    /
                  </button>

                  <input
                    ref={inputRef}
                    value={body}
                    onChange={e => { setBody(e.target.value); setShowCanned(e.target.value.startsWith('/')) }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') setShowCanned(false)
                      // Enter on an exact "/key" expands it instead of sending.
                      if (e.key === 'Enter' && body.startsWith('/')) {
                        const exact = canned.find(r => r.key === body.slice(1).toLowerCase().trim())
                        if (exact) { e.preventDefault(); applyCanned(exact); return }
                      }
                    }}
                    placeholder="Type a reply, or / for a saved one…"
                    maxLength={2000}
                    disabled={sending}
                    style={{ flex: 1, padding: '11px 16px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, color: '#fff', fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: 'none' }}
                  />
                  <button type="submit" disabled={!body.trim() || sending}
                    style={{ padding: '11px 22px', background: body.trim() ? `linear-gradient(135deg,${GOLD},#f59e0b)` : 'rgba(255,255,255,.08)', border: 'none', borderRadius: 12, color: body.trim() ? '#000' : SUBTLE, fontWeight: 800, fontSize: 14, cursor: body.trim() ? 'pointer' : 'default', fontFamily: "'Outfit',sans-serif", transition: 'all .15s' }}>
                    {sending ? '…' : 'Send'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {walletFor && (
        <PlayerWalletModal
          playerId={walletFor.user_id || walletFor.player?.id}
          playerName={walletFor.player?.full_name}
          onClose={() => setWalletFor(null)}
        />
      )}

      {manageCanned && (
        <CannedManager
          replies={canned}
          onClose={() => setManageCanned(false)}
          onSaved={next => { setCanned(next); setManageCanned(false) }}
        />
      )}
    </AdminLayout>
  )
}

// ─── Saved-reply editor ───────────────────────────────────────────────────────
function CannedManager({ replies, onClose, onSaved }) {
  const [rows, setRows] = useState(replies.length ? replies : [{ key: '', text: '' }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (i, field, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [field]: v } : r))

  async function save() {
    setSaving(true); setErr('')
    const clean = rows
      .map(r => ({ key: r.key.trim().toLowerCase().replace(/\s+/g, ''), text: r.text.trim() }))
      .filter(r => r.key && r.text)
    const data = await apiFetch('/api/admin/chat/canned', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replies: clean }) })
    setSaving(false)
    if (data.error) { setErr(data.error); return }
    onSaved(data.replies || clean)
  }

  const inp = { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none', boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0b1626', border: '1px solid rgba(251,191,36,.3)', borderRadius: 18, padding: 26, width: '100%', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Saved Replies</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.4)', margin: '0 0 18px', lineHeight: 1.6 }}>
          Give each reply a short key. In a chat, type <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>/</span> to pick one, or
          type <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>/key</span> and press Enter and the whole message drops in.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 8, alignItems: 'start' }}>
              <input value={r.key} onChange={e => set(i, 'key', e.target.value)} placeholder="key" style={{ ...inp, fontFamily: 'monospace' }} />
              <textarea value={r.text} onChange={e => set(i, 'text', e.target.value)} placeholder="The full message" rows={2} style={{ ...inp, resize: 'vertical' }} />
              <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} style={{ padding: '8px 10px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>

        <button onClick={() => setRows(rs => [...rs, { key: '', text: '' }])} style={{ marginTop: 12, padding: '8px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          + Add reply
        </button>

        {err && <p style={{ color: '#f87171', fontSize: 12.5, marginTop: 12 }}>⚠ {err}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 10, color: '#050505', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            {saving ? 'Saving…' : 'Save replies'}
          </button>
          <button onClick={onClose} style={{ padding: '11px 18px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.5)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
