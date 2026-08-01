'use client';
import { useState, useEffect } from 'react';
import { SkeletonCard, SkeletonRow } from '@/components/Skeleton';

type Meeting = { id: string; meeting_date: string; meeting_time: string | null; location: string | null; attendance_count: number; visitor_count: number; topic: string | null; minutes: string | null; sla_grade: string | null; created_at: string };

const SLA_COLORS: Record<string, { bg: string; text: string }> = {
  'A+': { bg: '#E1F5EE', text: '#085041' }, 'A': { bg: '#E1F5EE', text: '#085041' },
  'B': { bg: '#EEEDFE', text: '#3C3489' }, 'C': { bg: '#FAEEDA', text: '#633806' },
  'D': { bg: '#FAECE7', text: '#993C1D' }, 'F': { bg: '#FCEBEB', text: '#A32D2D' }, 'F-': { bg: '#FCEBEB', text: '#A32D2D' },
};

function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function CellMeetingsTab({ t }: { t: Record<string, string> }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ meeting_date: todayStr(), meeting_time: '', location: '', attendance_count: '', visitor_count: '', topic: '', minutes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function load() {
    fetch('/api/cell/meetings', { credentials: 'include' }).then(r => r.json()).then(({ data }) => setMeetings(data?.meetings || [])).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const thisWeekLogged = meetings.some(m => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(m.meeting_date) >= weekAgo;
  });

  async function submit() {
    if (!form.meeting_date) { setError('Meeting date is required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/cell/meetings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        setSuccess('Meeting logged.');
        setForm({ meeting_date: todayStr(), meeting_time: '', location: '', attendance_count: '', visitor_count: '', topic: '', minutes: '' });
        load();
        setTimeout(() => setSuccess(''), 3000);
      } else setError(json.error?.message || 'Failed to log meeting');
    } catch { setError('Network error — meeting was not logged.'); }
    setSaving(false);
  }

  if (loading) return (
    <SkeletonCard>
      {Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)}
    </SkeletonCard>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: thisWeekLogged ? t.tealBg : t.coralBg, borderRadius: 9, padding: '10px 14px', fontSize: 12, color: thisWeekLogged ? t.teal : t.coral, fontWeight: 600 }}>
        {thisWeekLogged ? 'This week\'s cell meeting is logged.' : 'No cell meeting logged this week yet.'}
      </div>

      <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Log this week&apos;s meeting</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', marginBottom: 4 }}>Date</div>
            <input type="date" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))}
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', marginBottom: 4 }}>Time</div>
            <input type="time" value={form.meeting_time} onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))}
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', marginBottom: 4 }}>Location</div>
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Bro. Emeka's house"
            style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', marginBottom: 4 }}>Attendance</div>
            <input type="number" value={form.attendance_count} onChange={e => setForm(f => ({ ...f, attendance_count: e.target.value }))} placeholder="0"
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', marginBottom: 4 }}>Visitors</div>
            <input type="number" value={form.visitor_count} onChange={e => setForm(f => ({ ...f, visitor_count: e.target.value }))} placeholder="0"
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', marginBottom: 4 }}>Topic</div>
          <input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="What was studied/discussed"
            style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', marginBottom: 4 }}>Minutes / notes</div>
          <textarea rows={3} value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} placeholder="Prayer points, decisions, follow-ups..."
            style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        {error && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {success && <div style={{ background: t.tealBg, color: t.teal, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>{success}</div>}
        <button onClick={submit} disabled={saving} style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Log meeting'}
        </button>
      </div>

      <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Meeting History</div>
        {meetings.length === 0 ? (
          <div style={{ fontSize: 12, color: t.muted }}>No meetings logged yet.</div>
        ) : meetings.map(m => {
          const sla = SLA_COLORS[m.sla_grade || 'A'] || SLA_COLORS['A'];
          return (
            <div key={m.id} style={{ padding: '10px 0', borderBottom: `0.5px solid ${t.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{m.meeting_date}{m.meeting_time ? ` · ${m.meeting_time}` : ''}{m.location ? ` · ${m.location}` : ''}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{m.attendance_count} present{m.visitor_count > 0 ? `, ${m.visitor_count} visitors` : ''}{m.topic ? ` · ${m.topic}` : ''}</div>
                </div>
                {m.sla_grade && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: sla.bg, color: sla.text, fontWeight: 600 }}>{m.sla_grade}</span>}
              </div>
              {m.minutes && <div style={{ fontSize: 11, color: t.sub, marginTop: 6, lineHeight: 1.5 }}>{m.minutes}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
