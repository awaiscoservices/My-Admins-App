/**
 * /admin/chat — Staff chat inbox
 *
 * Left panel: list of conversations for this casino (scoped server-side).
 * Right panel: message thread for the selected conversation.
 * Real-time: Supabase channel on chat_messages, filtered by conversation_id.
 *
 * Auth: uses the session token from supabase (browser client) for API calls.
 * All data fetched through /api/admin/chat/* which uses guardAdmin + service-role key.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/layout/AdminLayout'

// ─── helpers ──────────────────────────────────────────────────────────────────
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
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
      ...(opts.headers ?? {}),
    },
  })
  return r.json()
}

// ─── styles ───────────────────────────────────────────────────────────────────
const PANEL  = { background: 'linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018))', border: '1px solid rgba(251,191,36,.13)', borderRadius: 16 }
const GOLD   = '#fbbf24'
const SUBTLE = 'rgba(255,255,255,.45)'

// ─── ConversationList ─────────────────────────────────────────────────────────
function ConversationList({ convs, selected, onSelect, loading }) {
  if (loading) return (
    <div style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>Loading…</div>
  )
  if (!convs.length) return (
    <div style={{ padding: 24, textAlign: 'center', color: SUBTLE, fontSize: 13 }}>No open conversations</div>
  )
  return (
    <div>
      {convs.map(c => {
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
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function Bubble({ msg, myId }) {
  const isMe = msg.sender_id === myId || msg.sender_type === 'staff'
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '72%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isMe ? 'linear-gradient(135deg,#b45309,#92400e)' : 'rgba(255,255,255,.08)',
        border: isMe ? 'none' : '1px solid rgba(255,255,255,.1)',
        fontSize: 14, color: '#fff', lineHeight: 1.5, wordBreak: 'break-word',
      }}>
        {msg.body}
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>
          {fmtTime(msg.created_at)}
          {isMe && msg.read_at && <span style={{ marginLeft: 4 }}>✓✓</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminChat() {
  const [convs, setConvs]           = useState([])
  const [convLoading, setConvLoading] = useState(true)
  const [selected, setSelected]     = useState(null)
  const [messages, setMessages]     = useState([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [body, setBody]             = useState('')
  const [sending, setSending]       = useState(false)
  const [error, setError]           = useState('')
  const [myId, setMyId]             = useState(null)
  const bottomRef                   = useRef(null)
  const channelRef                  = useRef(null)

  // Get own user id for bubble alignment
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMyId(session?.user?.id ?? null)
    })
  }, [])

  // Load conversation list
  const loadConvs = useCallback(async () => {
    setConvLoading(true)
    const data = await apiFetch('/api/admin/chat/conversations?status=open')
    setConvs(data.conversations ?? [])
    setConvLoading(false)
  }, [])

  useEffect(() => { loadConvs() }, [loadConvs])

  // Load messages when a conversation is selected
  const loadMessages = useCallback(async (conv) => {
    setMsgLoading(true)
    setMessages([])
    const data = await apiFetch(`/api/admin/chat/messages?conversationId=${conv.id}`)
    setMessages(data.messages ?? [])
    setMsgLoading(false)
    // Clear unread badge
    setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c))
  }, [])

  const handleSelect = useCallback((conv) => {
    setSelected(conv)
    setError('')
    loadMessages(conv)
  }, [loadMessages])

  // Real-time subscription on selected conversation
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (!selected) return

    const ch = supabase
      .channel(`admin-chat-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        // Update last_message_at in list
        setConvs(prev => prev.map(c =>
          c.id === selected.id ? { ...c, last_message_at: payload.new.created_at } : c
        ))
      })
      .subscribe()

    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [selected?.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!body.trim() || !selected || sending) return
    setSending(true)
    setError('')
    const data = await apiFetch('/api/admin/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ conversationId: selected.id, body: body.trim() }),
    })
    setSending(false)
    if (data.error) { setError(data.error); return }
    setBody('')
    // Optimistic — real-time will also fire but dedup handles it
    setMessages(prev => prev.find(m => m.id === data.message.id) ? prev : [...prev, data.message])
  }

  return (
    <AdminLayout title="Chat">
      <Head><title>Chat — Casinoze Support</title></Head>

      <div style={{ padding: '24px 32px 32px', minHeight: '100vh', boxSizing: 'border-box' }}>
        <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 24 }}>
          Live Chat
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, height: 'calc(100vh - 160px)' }}>
          {/* Left — conversation list */}
          <div style={{ ...PANEL, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                Conversations
              </span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <ConversationList convs={convs} selected={selected} onSelect={handleSelect} loading={convLoading} />
            </div>
          </div>

          {/* Right — message thread */}
          <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUBTLE, fontSize: 14 }}>
                Select a conversation to start
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                      {selected.player?.full_name || selected.player?.email || 'Player'}
                    </div>
                    <div style={{ fontSize: 11, color: SUBTLE }}>{selected.player?.email}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', color: '#4ade80' }}>
                    {selected.status}
                  </span>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {msgLoading && (
                    <div style={{ textAlign: 'center', color: SUBTLE, fontSize: 13, padding: 20 }}>Loading…</div>
                  )}
                  {!msgLoading && messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: SUBTLE, fontSize: 13, padding: 20 }}>No messages yet</div>
                  )}
                  {messages.map(m => <Bubble key={m.id} msg={m} myId={myId} />)}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', gap: 10 }}>
                  {error && (
                    <div style={{ position: 'absolute', bottom: 70, left: 20, right: 20, padding: '8px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: '#f87171', fontSize: 12 }}>
                      {error}
                    </div>
                  )}
                  <input
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Type a reply…"
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
    </AdminLayout>
  )
}
