import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

const PRIORITY_COLOR = { low: '#64748b', medium: '#fbbf24', high: '#f87171', urgent: '#dc2626' };

export default function AdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('open');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, updated_at, players:player_id(display_name, email)')
      .eq('status', filter)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100);
    setTickets(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openTicket = async (ticket) => {
    setSelected(ticket);
    const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticket.id).order('created_at');
    setMessages(data || []);
    setReply('');
  };

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const handleReply = async (closeAfter = false) => {
    if (!reply.trim()) { showToast('Reply cannot be empty', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/support/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: selected.id, message: reply, close: closeAfter }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      showToast(closeAfter ? 'Replied and closed' : 'Reply sent');
      setReply('');
      if (closeAfter) { setSelected(null); fetchTickets(); }
      else { openTicket(selected); }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const fmtDate = d => d ? new Date(d).toLocaleString() : '—';

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: 0 }}>Support Tickets</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {['open','closed'].map(f => (
              <button key={f} onClick={() => { setFilter(f); setSelected(null); }} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter===f?'#fbbf24':'rgba(255,255,255,0.08)', color: filter===f?'#0f172a':'#e2e8f0', fontWeight: 600, textTransform: 'capitalize' }}>{f}</button>
            ))}
            <button onClick={fetchTickets} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)', background: 'transparent', color: '#fbbf24', cursor: 'pointer', fontWeight: 600 }}>↻</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '380px 1fr' : '1fr', gap: 20 }}>
          {/* Ticket list */}
          <div>
            {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div>
            : tickets.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>No {filter} tickets</div>
            : tickets.map(t => (
              <div key={t.id} onClick={() => openTicket(t)} style={{ padding: 14, marginBottom: 8, borderRadius: 10, border: `1px solid ${selected?.id===t.id?'rgba(251,191,36,0.4)':'rgba(255,255,255,0.06)'}`, background: selected?.id===t.id?'rgba(251,191,36,0.05)':'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{t.subject}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: PRIORITY_COLOR[t.priority]||'#94a3b8', textTransform: 'uppercase', marginLeft: 8 }}>{t.priority}</span>
                </div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{t.players?.display_name} · {fmtDate(t.created_at)}</div>
              </div>
            ))}
          </div>

          {/* Conversation panel */}
          {selected && (
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>{selected.subject}</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{selected.players?.display_name} · {selected.players?.email}</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380, marginBottom: 16 }}>
                {messages.map(m => (
                  <div key={m.id} style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: m.sender_type==='staff'?'rgba(251,191,36,0.08)':'rgba(255,255,255,0.04)', borderLeft: `3px solid ${m.sender_type==='staff'?'#fbbf24':'#475569'}` }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{m.sender_type==='staff'?'Staff':'Player'} · {fmtDate(m.created_at)}</div>
                    <div style={{ color: '#e2e8f0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  </div>
                ))}
              </div>
              <textarea value={reply} onChange={e=>setReply(e.target.value)} rows={3} placeholder="Type your reply…" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleReply(false)} disabled={submitting} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fbbf24', color: '#0f172a', fontWeight: 700 }}>Send Reply</button>
                <button onClick={() => handleReply(true)} disabled={submitting} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontWeight: 700 }}>Reply & Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type==='error'?'#f87171':'#4ade80', color: '#0f172a' }}>{toast.msg}</div>}
    </AdminLayout>
  );
}
