'use client';
import { useState, useEffect } from 'react';

interface PrayerRequest {
  id: string;
  request: string;
  requester_name: string;
  category: string;
  status: string;
  created_at: string;
  prayed_at: string | null;
}

interface Props { dark?: boolean; t?: Record<string, string>; }

export default function PrayerRequestPanel({ dark = false, t: tProp }: Props) {
  const LIGHT = { bg:'#F0EFF8',card:'#FFFFFF',text:'#1A1040',sub:'#5A5180',muted:'#9890CC',border:'rgba(83,74,183,0.12)',input:'#F7F6FF',purple:'#534AB7',purpleBg:'#EEEDFE',teal:'#1D9E75',tealBg:'#E1F5EE',coral:'#D85A30',coralBg:'#FAECE7',amber:'#BA7517',amberBg:'#FAEEDA' };
  const DARK = { bg:'#0F0A2E',card:'#1A1340',text:'#E8E5FF',sub:'#B8B0E8',muted:'#7870B0',border:'rgba(255,255,255,0.08)',input:'#1F1850',purple:'#A89FFF',purpleBg:'rgba(168,159,255,0.12)',teal:'#2DD4AA',tealBg:'rgba(45,212,170,0.12)',coral:'#F87171',coralBg:'rgba(248,113,113,0.12)',amber:'#FCD34D',amberBg:'rgba(252,211,77,0.12)' };
  const t = tProp || (dark ? DARK : LIGHT);

  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ request: '', requester_name: '', is_anonymous: false });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'open'|'prayed'|'all'>('open');

  const isReceiver = ['overseer', 'pa', 'lead_tech'].includes(userRole);
  const isSubmitter = ['cell_leader', 'fellowship_head', 'department_head', 'care_team'].includes(userRole);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.role) setUserRole(data.role); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userRole) return;
    const url = isReceiver ? `/api/prayer-requests?status=${filter}` : '/api/prayer-requests?status=all&scope=mine';
    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.requests) setRequests(data.requests); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userRole, filter, success]);

  async function submit() {
    if (!form.request.trim()) { setError('Prayer request is required'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/prayer-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ request: form.request.trim(), requester_name: form.is_anonymous ? 'Anonymous' : (form.requester_name.trim() || 'Anonymous') }),
      });
      if (res.ok) {
        setSuccess(true); setShowForm(false);
        setForm({ request: '', requester_name: '', is_anonymous: false });
        setTimeout(() => setSuccess(false), 5000);
      } else {
        const d = await res.json();
        setError(d?.error?.message || 'Failed to submit');
      }
    } catch { setError('Network error'); }
    setSubmitting(false);
  }

  async function markPrayed(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'prayed' ? 'open' : 'prayed';
    await fetch('/api/prayer-requests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id, status: newStatus }),
    });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  }

  const cardS = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e });
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* RECEIVER VIEW — Pastor, PA */}
      {isReceiver && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Prayer requests from leaders</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Cell leaders and HODs submit these for pastoral attention</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['open','prayed','all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `0.5px solid ${filter === f ? t.purple : t.border}`, background: filter === f ? t.purple : 'transparent', color: filter === f ? '#fff' : t.muted, fontSize: 11, cursor: 'pointer', fontWeight: filter === f ? 600 : 400 }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: t.muted, fontSize: 13 }}>Loading…</div>
          ) : requests.length === 0 ? (
            <div style={{ ...cardS({ padding: '32px', textAlign: 'center' }) }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No {filter === 'all' ? '' : filter} prayer requests</div>
              <div style={{ fontSize: 12, color: t.muted }}>When cell leaders submit prayer requests, they appear here in real time.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {requests.map(r => (
                <div key={r.id} style={cardS({ padding: '16px 18px' })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: t.text, lineHeight: 1.6, marginBottom: 8 }}>{r.request}</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: t.muted }}>From: <strong style={{ color: t.sub }}>{r.requester_name || 'Anonymous'}</strong></span>
                        <span style={{ fontSize: 10, color: t.muted }}>·</span>
                        <span style={{ fontSize: 11, color: t.muted }}>{formatDate(r.created_at)}</span>
                        {r.category && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: t.purpleBg, color: t.purple, fontWeight: 500 }}>{r.category}</span>}
                      </div>
                    </div>
                    <button onClick={() => markPrayed(r.id, r.status)}
                      style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: r.status === 'prayed' ? t.tealBg : t.purpleBg, color: r.status === 'prayed' ? t.teal : t.purple }}>
                      {r.status === 'prayed' ? '✓ Prayed' : 'Mark as prayed'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* SUBMITTER VIEW — Cell leaders, Fellowship heads, Dept heads */}
      {(isSubmitter || (!isReceiver && !isSubmitter)) && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Prayer Requests</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Submit prayer needs from your members — goes directly to the pastor</div>
            </div>
            {!showForm && <button onClick={() => setShowForm(true)} style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>+ Add request</button>}
          </div>

          {success && <div style={{ background: t.tealBg, border: `0.5px solid rgba(29,158,117,0.2)`, borderRadius: 9, padding: '10px 14px', fontSize: 12, color: t.teal, fontWeight: 500 }}>✓ Prayer request submitted. The pastor has been notified.</div>}

          {showForm && (
            <div style={cardS({ padding: '16px 18px' })}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>New prayer request</div>
              {error && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>{error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Prayer request *</div>
                  <textarea value={form.request} onChange={e => setForm(p => ({ ...p, request: e.target.value }))} rows={4}
                    placeholder="Describe the prayer need clearly…"
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 5 }}>Member name</div>
                  <input value={form.requester_name} onChange={e => setForm(p => ({ ...p, requester_name: e.target.value }))}
                    placeholder="Full name of the member"
                    disabled={form.is_anonymous}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: form.is_anonymous ? 'rgba(0,0,0,0.03)' : t.input, color: t.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, opacity: form.is_anonymous ? 0.5 : 1 }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.sub, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_anonymous} onChange={e => setForm(p => ({ ...p, is_anonymous: e.target.checked }))} />
                  Submit anonymously — name will not be shown to pastor
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={submit} disabled={submitting || !form.request.trim()}
                    style={{ flex: 1, background: t.purple, color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: submitting || !form.request.trim() ? 0.7 : 1 }}>
                    {submitting ? 'Submitting…' : 'Submit prayer request'}
                  </button>
                  <button onClick={() => { setShowForm(false); setError(''); }} style={{ background: 'transparent', color: t.muted, border: `0.5px solid ${t.border}`, borderRadius: 9, padding: '11px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {!loading && requests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.sub }}>My submitted requests</div>
              {requests.map(r => (
                <div key={r.id} style={cardS({ padding: '12px 16px' })}>
                  <div style={{ fontSize: 13, color: t.text, marginBottom: 6 }}>{r.request}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: r.status === 'prayed' ? t.tealBg : t.purpleBg, color: r.status === 'prayed' ? t.teal : t.purple }}>{r.status === 'prayed' ? 'Prayed for' : 'Open'}</span>
                    <span style={{ fontSize: 11, color: t.muted }}>{formatDate(r.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
