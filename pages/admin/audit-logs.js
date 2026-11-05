import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';

const ACTIONS = ['','kyc_approve','kyc_reject','game_load_approve','game_load_reject','redemption_approve','redemption_reject','withdrawal_approve','withdrawal_reject','adjustment_credit','adjustment_debit','staff_invite','staff_role_change','staff_activate','staff_deactivate','game_create','game_update','promo_create','promo_update','level_update','setting_update','risk_flag','risk_unflag'];

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('audit_logs').select('id, action, performed_by, target_type, target_id, details, created_at, staff:performed_by(email)')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (actionFilter) q = q.eq('action', actionFilter);
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59');
    const { data } = await q;
    setLogs(data || []);
    setLoading(false);
  }, [actionFilter, dateFrom, dateTo, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const fmtDate = d => d ? new Date(d).toLocaleString() : '—';

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: 26, color: '#fbbf24', margin: '0 0 24px' }}>Audit Logs</h1>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <select value={actionFilter} onChange={e=>{setActionFilter(e.target.value);setPage(0);}} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 13 }}>
            {ACTIONS.map(a => <option key={a} value={a}>{a||'All Actions'}</option>)}
          </select>
          <input value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(0);}} type="date" style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }} />
          <input value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(0);}} type="date" style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: '#e2e8f0', fontSize: 14 }} />
          <button onClick={fetchLogs} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)', background: 'transparent', color: '#fbbf24', cursor: 'pointer', fontWeight: 600 }}>↻</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading…</div>
        : logs.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>No logs found</div>
        : (
          <>
            {logs.map((log, i) => (
              <div key={log.id} style={{ marginBottom: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                <div onClick={() => setExpanded(expanded===log.id?null:log.id)} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 12 }}>
                  <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 12, minWidth: 220, fontWeight: 600 }}>{log.action}</span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{log.staff?.email||log.performed_by?.slice(0,8)||'—'}</span>
                  <span style={{ color: '#475569', fontSize: 12 }}>→ {log.target_type} {log.target_id?.slice(0,8)}</span>
                  <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(log.created_at)}</span>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{expanded===log.id?'▲':'▼'}</span>
                </div>
                {expanded === log.id && log.details && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                    <pre style={{ color: '#94a3b8', fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{JSON.stringify(log.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center' }}>
              <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: page===0?'#475569':'#e2e8f0', cursor: page===0?'default':'pointer' }}>← Prev</button>
              <span style={{ color: '#94a3b8', padding: '7px 10px' }}>Page {page+1}</span>
              <button onClick={() => setPage(p=>p+1)} disabled={logs.length<PAGE_SIZE} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: logs.length<PAGE_SIZE?'#475569':'#e2e8f0', cursor: logs.length<PAGE_SIZE?'default':'pointer' }}>Next →</button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
