'use client';
import { useState, useEffect } from 'react';

type RosterRow = { id: string; full_name: string; is_active: boolean; assigned: number; resolved: number; avg_sla_score: number | null };
type TimerRow = { id: string; full_name: string; status: string; assigned_name: string; sla_grade: string | null; created_at: string };
type LeadRow = { id: string; member_name: string; weeks_absent: number; status: string; assigned_name: string; sla_grade: string | null; created_at: string };
type Overview = {
  summary: { total_first_timers: number; new_first_timers_30d: number; total_absentee_leads: number; restored_30d: number };
  timer_counts: Record<string, number>;
  lead_counts: Record<string, number>;
  roster: RosterRow[];
  recent_first_timers: TimerRow[];
  recent_leads: LeadRow[];
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', follow_up: 'Follow-up', converted: 'Converted', declined: 'Declined', other: 'Other',
  in_progress: 'In progress', reached: 'Reached', visited: 'Visited', restored: 'Restored', unreachable: 'Unreachable', closed: 'Closed',
};

export default function CareFollowupPanel({ t }: { t: Record<string, string> }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/care/overview', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data) setData(data); })
      .finally(() => setLoading(false));
  }, []);

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px', ...extra,
  });

  if (loading) return <div style={{ fontSize: 12, color: t.sub, padding: 20 }}>Loading care & follow-up engagement…</div>;
  if (!data) return <div style={{ fontSize: 12, color: t.sub, padding: 20 }}>Could not load care team data.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Care & Follow-up</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>First-timer pipeline and absentee restoration — real-time from the care team&apos;s own portal.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'First-timers (all-time)', value: data.summary.total_first_timers, accent: '#534AB7' },
          { label: 'New first-timers (30d)', value: data.summary.new_first_timers_30d, accent: '#1D9E75' },
          { label: 'Absentee leads open', value: data.summary.total_absentee_leads, accent: '#BA7517' },
          { label: 'Restored (30d)', value: data.summary.restored_30d, accent: '#1D9E75' },
        ].map(k => (
          <div key={k.label} style={{ ...card(), borderTop: `2.5px solid ${k.accent}` }}>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={card()}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>First-timer pipeline</div>
          {Object.entries(data.timer_counts).filter(([, v]) => v > 0).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `0.5px solid ${t.border}`, fontSize: 12 }}>
              <span style={{ color: t.sub }}>{STATUS_LABEL[k] || k}</span>
              <span style={{ color: t.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={card()}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Absentee restoration pipeline</div>
          {Object.entries(data.lead_counts).filter(([, v]) => v > 0).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `0.5px solid ${t.border}`, fontSize: 12 }}>
              <span style={{ color: t.sub }}>{STATUS_LABEL[k] || k}</span>
              <span style={{ color: t.text, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Care team engagement</div>
        {data.roster.length === 0 ? (
          <div style={{ fontSize: 12, color: t.muted }}>No care team members yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                  {['Member', 'Assigned', 'Resolved', 'Resolution rate', 'Avg SLA'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.roster.map(m => {
                  const rate = m.assigned > 0 ? Math.round((m.resolved / m.assigned) * 100) : 0;
                  return (
                    <tr key={m.id} style={{ borderBottom: `0.5px solid ${t.border}` }}>
                      <td style={{ padding: '8px 10px', color: t.text, fontWeight: 500 }}>{m.full_name}{!m.is_active && <span style={{ color: t.coral, fontSize: 10, marginLeft: 6 }}>(inactive)</span>}</td>
                      <td style={{ padding: '8px 10px', color: t.text }}>{m.assigned}</td>
                      <td style={{ padding: '8px 10px', color: t.text }}>{m.resolved}</td>
                      <td style={{ padding: '8px 10px', color: rate >= 60 ? t.teal : t.coral, fontWeight: 600 }}>{rate}%</td>
                      <td style={{ padding: '8px 10px', color: t.muted }}>{m.avg_sla_score == null ? '—' : `${m.avg_sla_score}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={card()}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Recent first-timers</div>
          {data.recent_first_timers.length === 0 ? <div style={{ fontSize: 12, color: t.muted }}>None yet.</div> : data.recent_first_timers.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `0.5px solid ${t.border}` }}>
              <div>
                <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{r.full_name}</div>
                <div style={{ fontSize: 10, color: t.muted }}>{r.assigned_name}</div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: t.purpleBg, color: t.purple, fontWeight: 500 }}>{STATUS_LABEL[r.status] || r.status}</span>
            </div>
          ))}
        </div>
        <div style={card()}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Recent absentee leads</div>
          {data.recent_leads.length === 0 ? <div style={{ fontSize: 12, color: t.muted }}>None yet.</div> : data.recent_leads.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `0.5px solid ${t.border}` }}>
              <div>
                <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{r.member_name}</div>
                <div style={{ fontSize: 10, color: t.muted }}>{r.weeks_absent} weeks absent · {r.assigned_name}</div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: t.purpleBg, color: t.purple, fontWeight: 500 }}>{STATUS_LABEL[r.status] || r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
