'use client';
import { useState, useEffect } from 'react';

type PrayerRequest = {
  id: string;
  request: string;
  requester_name: string;
  category: string;
  is_anonymous: boolean;
  status: 'open' | 'prayed' | 'closed';
  created_at: string;
};

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'healing', label: 'Healing' },
  { value: 'family', label: 'Family' },
  { value: 'finance', label: 'Finance' },
  { value: 'guidance', label: 'Guidance' },
  { value: 'thanksgiving', label: 'Thanksgiving' },
  { value: 'other', label: 'Other' },
];

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  open:   { bg: '#EEEDFE', text: '#3C3489', label: 'Open' },
  prayed: { bg: '#E1F5EE', text: '#085041', label: 'Prayed' },
  closed: { bg: '#F3F4F6', text: '#6B7280', label: 'Closed' },
};

interface PrayerRequestPanelProps {
  dark?: boolean;
  t: Record<string, string>;
}

export default function PrayerRequestPanel({ dark = false, t }: PrayerRequestPanelProps) {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [form, setForm] = useState({ request: '', requester_name: '', category: 'general', is_anonymous: false });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch('/api/prayer-requests', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.requests) setRequests(data.requests); })
      .catch(() => {});
  }, [success]);

  async function submit() {
    if (!form.request.trim()) { setError('Please enter the prayer request.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/prayer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess(true);
        setForm({ request: '', requester_name: '', category: 'general', is_anonymous: false });
        setShowForm(false);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        const json = await res.json();
        setError(json.error?.message || 'Failed to submit.');
      }
    } catch { setError('Network error.'); }
    setSubmitting(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Prayer Requests</div>
          <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Submit prayer needs from your cell members. Goes directly to the pastor.</div>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
          + Add request
        </button>
      </div>

      {/* Success */}
      {success && (
        <div style={{ background: t.tealBg, border: `0.5px solid rgba(29,158,117,0.2)`, borderRadius: 9, padding: '10px 14px', fontSize: 12, color: t.teal, fontWeight: 500 }}>
          Prayer request submitted. The pastor has been notified.
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>New prayer request</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Prayer request *</div>
              <textarea
                value={form.request}
                onChange={e => setForm(p => ({ ...p, request: e.target.value }))}
                placeholder="Describe the prayer need..."
                rows={3}
                style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Member name</div>
                <input
                  value={form.requester_name}
                  onChange={e => setForm(p => ({ ...p, requester_name: e.target.value }))}
                  placeholder={form.is_anonymous ? 'Anonymous' : 'Full name'}
                  disabled={form.is_anonymous}
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: form.is_anonymous ? 'rgba(0,0,0,0.1)' : t.input, color: t.text, outline: 'none', fontFamily: 'inherit', opacity: form.is_anonymous ? 0.5 : 1 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Category</div>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="anon" checked={form.is_anonymous} onChange={e => setForm(p => ({ ...p, is_anonymous: e.target.checked }))} style={{ cursor: 'pointer' }} />
              <label htmlFor="anon" style={{ fontSize: 12, color: t.sub, cursor: 'pointer' }}>Submit anonymously — name will not be shown to pastor</label>
            </div>
            {error && <div style={{ fontSize: 12, color: t.coral }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} disabled={submitting}
                style={{ flex: 1, background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Submitting...' : 'Submit prayer request'}
              </button>
              <button onClick={() => { setShowForm(false); setError(''); }}
                style={{ background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 9, padding: '11px 16px', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request list */}
      {requests.length === 0 ? (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🙏</div>
          <div style={{ fontSize: 13, color: t.sub }}>No prayer requests yet</div>
          <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Requests from your cell members will appear here</div>
        </div>
      ) : (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
          {requests.map((r, i) => {
            const cfg = STATUS_CFG[r.status] || STATUS_CFG.open;
            const daysAgo = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
            return (
              <div key={r.id} style={{ padding: '13px 16px', borderBottom: i < requests.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{r.requester_name || 'Anonymous'}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: t.purpleBg, color: t.purple, fontWeight: 500 }}>{CATEGORIES.find(c => c.value === r.category)?.label || r.category}</span>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: cfg.bg, color: cfg.text, fontWeight: 500 }}>{cfg.label}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.5, marginBottom: 4 }}>{r.request}</div>
                <div style={{ fontSize: 10, color: t.muted }}>{daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
