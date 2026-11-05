import { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

export default function AdminNotifications() {
  const [form, setForm] = useState({ title: '', message: '', target: 'all', min_level: 1, send_at: '' });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await supabase.from('broadcast_notifications').select('*').order('created_at', { ascending: false }).limit(50);
    setHistory(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchHistory(); }, []);

  const showToast = (msg, t='success') => { setToast({ msg, type: t }); setTimeout(() => setToast(null), 4000); };

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) { showToast('Title and message required','error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/notifications/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error||'Failed');
      showToast(d.sent_count != null ? `Sent to ${d.sent_count} players` : 'Notification queued');
      setForm({ title: '', message: '', target: 'all', min_level: 1, send_at: '' });
      fetchHistory();
    } catch (e) { showToast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const fmtDate = d => d ? new Date(d).toLocaleString() : '—';

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: '0 0 24px' }}>Broadcast Notifications</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20 }}>
          {/* Compose form */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 22 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 18, fontSize: 15 }}>Compose</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Title</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Notification title…" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Message</label>
              <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} rows={4} placeholder="Notification body…" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Target Audience</label>
              <select value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }}>
                <option value="all">All Players</option>
                <option value="vip">VIP Players</option>
                <option value="level_plus">Level and Above</option>
              </select>
            </div>

            {form.target === 'level_plus' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Minimum Level</label>
                <input type="number" min="1" max="10" value={form.min_level} onChange={e=>setForm(f=>({...f,min_level:parseInt(e.target.value)||1}))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Schedule (leave blank to send now)</label>
              <input type="datetime-local" value={form.send_at} onChange={e=>setForm(f=>({...f,send_at:e.target.value}))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }} />
            </div>

            <button onClick={handleSend} disabled={submitting} style={{ width: '100%', padding: 13, borderRadius: 8, border: 'none', cursor: submitting?'not-allowed':'pointer', fontWeight: 700, fontSize: 15, background: '#fbbf24', color: '#0f172a', opacity: submitting?0.7:1 }}>{submitting?'Sending…':form.send_at?'Schedule Notification':'Send Now'}</button>
          </div>

          {/* History */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 22 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 18, fontSize: 15 }}>Sent History</div>
            {loading ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Loading…</div>
            : history.length === 0 ? <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No notifications sent yet</div>
            : history.map(h => (
              <div key={h.id} style={{ marginBottom: 10, padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{h.title}</span>
                  <span style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap', marginLeft: 10 }}>{fmtDate(h.created_at)}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>{h.message}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: '#64748b', textTransform: 'capitalize' }}>{h.target}</span>
                  {h.sent_count != null && <span style={{ fontSize: 11, color: '#4ade80' }}>✓ {h.sent_count} recipients</span>}
                  {h.send_at && new Date(h.send_at) > new Date() && <span style={{ fontSize: 11, color: '#fbbf24' }}>⏰ Scheduled {fmtDate(h.send_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type==='error'?'#f87171':'#4ade80', color: '#0f172a' }}>{toast.msg}</div>}
    </AdminLayout>
  );
}
