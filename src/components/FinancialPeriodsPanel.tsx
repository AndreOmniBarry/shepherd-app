'use client';
import { useState, useEffect } from 'react';

type Period = { id: string; period_month: string; closed_at: string; note: string | null };

function thisMonth() { return new Date().toISOString().slice(0, 7); }
function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// Lock-step reconciliation: closing a month freezes its reported income
// figure — any new entry for that month afterward must be explicitly logged
// as an adjustment (see the income form), so a "final" number never quietly
// drifts once it's been shared.
export default function FinancialPeriodsPanel({ t }: { t: Record<string, string> }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [closeMonth, setCloseMonth] = useState(thisMonth());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function load() {
    fetch('/api/accounts/periods', { credentials: 'include' }).then(r => r.json()).then(({ data }) => setPeriods(data?.periods || []));
  }
  useEffect(() => { load(); }, []);

  async function closePeriod() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/accounts/periods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ period_month: closeMonth, note }),
      });
      if (res.ok) { setNote(''); load(); }
      else { const j = await res.json().catch(() => ({})); setError(j?.error?.message || 'Failed to close period'); }
    } catch { setError('Network error'); }
    setSubmitting(false);
  }

  return (
    <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Closed periods</div>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 12, lineHeight: 1.5 }}>
        Closing a month locks its reported figure. New income for a closed month must be logged as an explicit adjustment instead of silently changing the total.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input type="month" value={closeMonth} max={thisMonth()} onChange={e => setCloseMonth(e.target.value)}
          style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
          style={{ flex: 1, minWidth: 140, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
        <button onClick={closePeriod} disabled={submitting}
          style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Closing…' : 'Close month'}
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: t.coral, marginBottom: 8 }}>{error}</div>}
      {periods.length === 0 ? (
        <div style={{ fontSize: 12, color: t.muted }}>No periods closed yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {periods.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: `0.5px solid ${t.border}` }}>
              <span style={{ color: t.text, fontWeight: 500 }}>{monthLabel(p.period_month.slice(0, 7))}</span>
              <span style={{ color: t.muted }}>{p.note || 'Closed'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
