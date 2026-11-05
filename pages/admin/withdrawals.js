import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';


export default function AdminWithdrawals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('pending');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('withdrawals')
      .select(`
        id, status, amount_cents, reserved_cents,
        payment_method, payment_details, idempotency_key,
        created_at, updated_at,
        players:player_id (id, display_name, email)
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

  const openModal = (item, action) => { setModal({ item, action }); setReason(''); };
  const closeModal = () => { setModal(null); setReason(''); };

  const handleSubmit = async () => {
    if (!modal) return;
    if (!reason.trim()) { showToast('Reason required', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/withdrawals/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawal_id: modal.item.id, action: modal.action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast(`Withdrawal ${modal.action}d`);
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

  const maskPayment = (method, details) => {
    if (!details) return method || '—';
    try {
      const d = typeof details === 'string' ? JSON.parse(details) : details;
      if (method === 'bank') return `Bank ****${d.account_last4 || '????'}`;
      if (method === 'crypto') return `${d.coin || 'Crypto'} …${String(d.address || '').slice(-6)}`;
      return method;
    } catch { return method; }
  };

  return (
    <AdminLayout>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 26, color: '#fbbf24', margin: 0 }}>Withdrawal Requests</h1>
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
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>No {filter} withdrawals</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
                  {['Player','Amount','Reserved','Payment Method','Status','Submitted','Actions'].map(h => (
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
                    <td style={{ padding: '12px', color: '#fbbf24', fontWeight: 700 }}>{fmt(item.amount_cents)}</td>
                    <td style={{ padding: '12px', color: '#94a3b8' }}>{fmt(item.reserved_cents)}</td>
                    <td style={{ padding: '12px', color: '#e2e8f0' }}>{maskPayment(item.payment_method, item.payment_details)}</td>
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

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 420, border: '1px solid rgba(251,191,36,0.2)' }}>
            <h2 style={{ fontFamily: 'Cinzel, serif', color: '#fbbf24', margin: '0 0 20px', fontSize: 20, textTransform: 'capitalize' }}>
              {modal.action} Withdrawal
            </h2>
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{modal.item.players?.display_name}</div>
              <div style={{ color: '#fbbf24', fontWeight: 700, marginTop: 6 }}>{fmt(modal.item.amount_cents)}</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>{maskPayment(modal.item.payment_method, modal.item.payment_details)}</div>
              {modal.action === 'reject' && (
                <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>⚠ Rejection will release reserved funds back to player wallet</div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Reason (required)</label>
              <textarea
                value={reason} onChange={e => setReason(e.target.value)}
                rows={3} placeholder={modal.action === 'approve' ? 'e.g. Verified, processed via bank transfer' : 'Enter rejection reason…'}
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

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, background: toast.type === 'error' ? '#f87171' : '#4ade80', color: '#0f172a' }}>
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
}
