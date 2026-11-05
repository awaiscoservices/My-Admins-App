import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';


export default function AdminRedemptions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { item, action }
  const [reason, setReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('pending');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('redemptions')
      .select(`
        id, status, requested_amount_cents, approved_amount_cents,
        game_account_id, idempotency_key, created_at, updated_at,
        players:player_id (id, display_name, email),
        game_accounts:game_account_id (game_username, games:game_id (name))
      `)
      .eq('status', filter)
      .order('created_at', { ascending: true })
      .limit(100);
    if (!error) setItems(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const openModal = (item, action) => {
    setModal({ item, action });
    setReason('');
    setApprovedAmount(action === 'approve' ? String((item.requested_amount_cents / 100).toFixed(2)) : '');
  };

  const closeModal = () => { setModal(null); setReason(''); setApprovedAmount(''); };

  const handleSubmit = async () => {
    if (!modal) return;
    if (modal.action === 'reject' && !reason.trim()) {
      showToast('Reason required for rejection', 'error'); return;
    }
    setSubmitting(true);
    const body = { redemption_id: modal.item.id, action: modal.action, reason };
    if (modal.action === 'approve' && approvedAmount) {
      body.approved_amount_cents = Math.round(parseFloat(approvedAmount) * 100);
    }
    try {
      const res = await fetch('/api/admin/redemptions/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast(`Redemption ${modal.action}d`);
      closeModal();
      fetchItems();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (cents) => cents != null ? `$${(cents / 100).toFixed(2)}` : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

  return (
    <AdminLayout>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 26, color: '#fbbf24', margin: 0 }}>Redemption Requests</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {['pending', 'approved', 'rejected'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: filter === f ? '#fbbf24' : 'rgba(255,255,255,0.08)',
                color: filter === f ? '#0f172a' : '#e2e8f0', fontWeight: 600, textTransform: 'capitalize',
              }}>{f}</button>
            ))}
            <button onClick={fetchItems} style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)',
              background: 'transparent', color: '#fbbf24', cursor: 'pointer', fontWeight: 600,
            }}>↻ Refresh</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>No {filter} redemptions</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
                  {['Player','Game / Account','Requested','Approved','Status','Submitted','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '12px', color: '#e2e8f0' }}>
                      <div style={{ fontWeight: 600 }}>{item.players?.display_name || '—'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{item.players?.email}</div>
                    </td>
                    <td style={{ padding: '12px', color: '#e2e8f0' }}>
                      <div>{item.game_accounts?.games?.name || '—'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{item.game_accounts?.game_username}</div>
                    </td>
                    <td style={{ padding: '12px', color: '#fbbf24', fontWeight: 700 }}>{fmt(item.requested_amount_cents)}</td>
                    <td style={{ padding: '12px', color: '#4ade80', fontWeight: 700 }}>{fmt(item.approved_amount_cents)}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: item.status === 'pending' ? 'rgba(251,191,36,0.15)' : item.status === 'approved' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                        color: item.status === 'pending' ? '#fbbf24' : item.status === 'approved' ? '#4ade80' : '#f87171',
                      }}>{item.status}</span>
                    </td>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(item.created_at)}</td>
                    <td style={{ padding: '12px' }}>
                      {item.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openModal(item, 'approve')} style={{
                            padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontWeight: 600, fontSize: 12,
                          }}>Approve</button>
                          <button onClick={() => openModal(item, 'reject')} style={{
                            padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: 'rgba(248,113,113,0.15)', color: '#f87171', fontWeight: 600, fontSize: 12,
                          }}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 440, border: '1px solid rgba(251,191,36,0.2)' }}>
            <h2 style={{ fontFamily: 'Cinzel, serif', color: '#fbbf24', margin: '0 0 20px', fontSize: 20, textTransform: 'capitalize' }}>
              {modal.action} Redemption
            </h2>
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{modal.item.players?.display_name}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{modal.item.game_accounts?.games?.name} · {modal.item.game_accounts?.game_username}</div>
              <div style={{ color: '#fbbf24', fontWeight: 700, marginTop: 6 }}>Requested: {fmt(modal.item.requested_amount_cents)}</div>
            </div>

            {modal.action === 'approve' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Approved Amount ($)</label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={approvedAmount}
                  onChange={e => setApprovedAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>
                {modal.action === 'reject' ? 'Reason (required)' : 'Note (optional)'}
              </label>
              <textarea
                value={reason} onChange={e => setReason(e.target.value)}
                rows={3} placeholder={modal.action === 'reject' ? 'Enter rejection reason…' : 'Optional note…'}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={closeModal} disabled={submitting} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700,
                background: modal.action === 'approve' ? '#4ade80' : '#f87171',
                color: '#0f172a', opacity: submitting ? 0.7 : 1, textTransform: 'capitalize',
              }}>{submitting ? 'Processing…' : modal.action}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type === 'error' ? '#f87171' : '#4ade80', color: '#0f172a' }}>
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
}
