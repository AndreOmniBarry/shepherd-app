'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type LeadStats = {
  total: number;
  new: number;
  inProgress: number;
  reached: number;
  restored: number;
  unreachable: number;
  urgent: number;
  avgResponseDays: number;
};

type FirstTimerStats = {
  total: number;
  contacted: number;
  converted: number;
  pending: number;
  conversionRate: number;
};

type WeeklyActivity = {
  week: string;
  leads: number;
  restored: number;
  firstTimers: number;
};

interface CareOverviewProps {
  dark?: boolean;
  t: Record<string, string>;
}

export default function CareOverview({ dark = false, t }: CareOverviewProps) {
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [firstTimerStats, setFirstTimerStats] = useState<FirstTimerStats | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderName, setLeaderName] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/care/leads', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/care/first-timers', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()),
    ]).then(([leadsRes, timersRes, meRes]) => {
      const leads = leadsRes.data?.leads || [];
      const timers = timersRes.data?.first_timers || [];
      const me = meRes.data;
      if (me) setLeaderName(me.name || '');

      // Lead stats
      const urgent = leads.filter((l: Record<string, unknown>) => (l.weeks_absent as number) >= 3 && !['closed','restored'].includes(l.status as string));
      const restored = leads.filter((l: Record<string, unknown>) => l.status === 'restored');
      const unreachable = leads.filter((l: Record<string, unknown>) => l.status === 'unreachable');
      const inProgress = leads.filter((l: Record<string, unknown>) => ['in_progress','reached','visited'].includes(l.status as string));
      const newLeads = leads.filter((l: Record<string, unknown>) => l.status === 'new');

      // Avg response time (days from created to first contact)
      const respondedLeads = leads.filter((l: Record<string, unknown>) => l.last_contact);
      const avgDays = respondedLeads.length > 0
        ? Math.round(respondedLeads.reduce((sum: number, l: Record<string, unknown>) => {
            const diff = (new Date(l.last_contact as string).getTime() - new Date(l.created_at as string).getTime()) / 86400000;
            return sum + diff;
          }, 0) / respondedLeads.length)
        : 0;

      setLeadStats({
        total: leads.length,
        new: newLeads.length,
        inProgress: inProgress.length,
        reached: leads.filter((l: Record<string, unknown>) => l.status === 'reached').length,
        restored: restored.length,
        unreachable: unreachable.length,
        urgent: urgent.length,
        avgResponseDays: avgDays,
      });

      // First timer stats
      const converted = timers.filter((t: Record<string, unknown>) => t.status === 'converted');
      const contacted = timers.filter((t: Record<string, unknown>) => ['contacted','follow_up','converted'].includes(t.status as string));
      const pending = timers.filter((t: Record<string, unknown>) => t.status === 'new');
      setFirstTimerStats({
        total: timers.length,
        contacted: contacted.length,
        converted: converted.length,
        pending: pending.length,
        conversionRate: timers.length > 0 ? Math.round((converted.length / timers.length) * 100) : 0,
      });

      // Weekly activity (last 8 weeks)
      const weeks: WeeklyActivity[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekLeads = leads.filter((l: Record<string, unknown>) => {
          const d = new Date(l.created_at as string);
          return d >= weekStart && d < weekEnd;
        });
        const weekRestored = leads.filter((l: Record<string, unknown>) => {
          if (l.status !== 'restored' || !l.updated_at) return false;
          const d = new Date(l.updated_at as string);
          return d >= weekStart && d < weekEnd;
        });
        const weekTimers = timers.filter((t: Record<string, unknown>) => {
          const d = new Date(t.created_at as string);
          return d >= weekStart && d < weekEnd;
        });
        weeks.push({
          week: `W${8-i}`,
          leads: weekLeads.length,
          restored: weekRestored.length,
          firstTimers: weekTimers.length,
        });
      }
      setWeeklyActivity(weeks);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading care team intelligence...</div>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Action items
  const actions: { priority: 'high' | 'medium' | 'low'; message: string }[] = [];
  if (leadStats && leadStats.urgent > 0) actions.push({ priority: 'high', message: `${leadStats.urgent} member${leadStats.urgent > 1 ? 's have' : ' has'} been absent 3+ weeks — escalate to fellowship head immediately` });
  if (leadStats && leadStats.new > 0) actions.push({ priority: 'high', message: `${leadStats.new} new lead${leadStats.new > 1 ? 's' : ''} assigned — make first contact today for A+ SLA` });
  if (firstTimerStats && firstTimerStats.pending > 0) actions.push({ priority: 'medium', message: `${firstTimerStats.pending} first timer${firstTimerStats.pending > 1 ? 's' : ''} not yet contacted — reach out within 24 hours` });
  if (leadStats && leadStats.avgResponseDays > 3) actions.push({ priority: 'medium', message: `Average response time is ${leadStats.avgResponseDays} days — aim for Monday contact for best SLA` });

  const STATUS_PIPELINE = leadStats ? [
    { label: 'New', value: leadStats.new, color: '#534AB7', bg: '#EEEDFE' },
    { label: 'In progress', value: leadStats.inProgress, color: '#BA7517', bg: '#FAEEDA' },
    { label: 'Reached', value: leadStats.reached, color: '#1D9E75', bg: '#E1F5EE' },
    { label: 'Restored', value: leadStats.restored, color: '#1D9E75', bg: '#E1F5EE' },
    { label: 'Unreachable', value: leadStats.unreachable, color: '#D85A30', bg: '#FAECE7' },
    { label: 'Urgent', value: leadStats.urgent, color: '#C62828', bg: '#FCEBEB' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Greeting */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{greeting}{leaderName ? `, ${leaderName.split(' ')[0]}` : ''}</div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }} suppressHydrationWarning>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · Follow-Up & Care Team
        </div>
      </div>

      {/* Action items */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {actions.map((a, i) => {
            const cfg = a.priority === 'high'
              ? { bg: '#FCEBEB', text: '#A32D2D', border: 'rgba(198,40,40,0.2)', icon: '⚠' }
              : { bg: '#FAEEDA', text: '#633806', border: 'rgba(186,117,23,0.2)', icon: '●' };
            return (
              <div key={i} style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 9, padding: '10px 13px', fontSize: 12, color: cfg.text, display: 'flex', gap: 8, lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, fontWeight: 700 }}>{cfg.icon}</span>
                {a.message}
              </div>
            );
          })}
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Total leads', value: leadStats?.total ?? '—', sub: 'All time', accent: '#534AB7' },
          { label: 'Restored', value: leadStats?.restored ?? '—', sub: 'Members back', accent: '#1D9E75' },
          { label: 'First timers', value: firstTimerStats?.total ?? '—', sub: `${firstTimerStats?.conversionRate ?? 0}% converted`, accent: '#BA7517' },
          { label: 'Avg response', value: leadStats?.avgResponseDays !== undefined ? `${leadStats.avgResponseDays}d` : '—', sub: 'Days to first contact', accent: leadStats && leadStats.avgResponseDays > 3 ? '#D85A30' : '#1D9E75' },
        ].map(k => (
          <div key={k.label} style={{ background: t.card, borderRadius: 11, border: `0.5px solid ${t.border}`, padding: '12px 14px', borderTop: `2.5px solid ${k.accent}` }}>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.text, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Lead pipeline */}
      <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Lead pipeline status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {STATUS_PIPELINE.map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* First timer pipeline */}
      {firstTimerStats && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>First timer pipeline</div>
            <div style={{ fontSize: 12, color: t.teal, fontWeight: 600 }}>{firstTimerStats.conversionRate}% conversion rate</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { label: 'Total logged', value: firstTimerStats.total, color: t.purple, bg: t.purpleBg },
              { label: 'Contacted', value: firstTimerStats.contacted, color: t.amber, bg: t.amberBg },
              { label: 'Converted', value: firstTimerStats.converted, color: t.teal, bg: t.tealBg },
              { label: 'Pending', value: firstTimerStats.pending, color: t.coral, bg: t.coralBg },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Conversion bar */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: t.muted, marginBottom: 4 }}>
              <span>Conversion progress</span>
              <span>{firstTimerStats.converted} of {firstTimerStats.total}</span>
            </div>
            <div style={{ height: 5, background: t.input, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${firstTimerStats.conversionRate}%`, background: '#1D9E75', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Weekly activity chart */}
      {weeklyActivity.length > 0 && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Weekly activity</div>
          <div style={{ fontSize: 10, color: t.muted, marginBottom: 12 }}>New leads, restorations, and first timers per week</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weeklyActivity} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#2A2A2A' : '#F0F0F0'} />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: dark ? '#888' : '#6B7280' }} />
              <YAxis tick={{ fontSize: 9, fill: dark ? '#888' : '#6B7280' }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: t.card, color: t.text }} />
              <Bar dataKey="leads" name="New leads" fill="#534AB7" radius={[3,3,0,0]} />
              <Bar dataKey="restored" name="Restored" fill="#1D9E75" radius={[3,3,0,0]} />
              <Bar dataKey="firstTimers" name="First timers" fill="#BA7517" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* SLA reminder */}
      <div style={{ background: t.purpleBg, borderRadius: 10, padding: '12px 14px', border: `0.5px solid rgba(83,74,183,0.15)`, fontSize: 11, color: t.purple, lineHeight: 1.6 }}>
        <strong>Care Team SLA:</strong> First contact Monday = A+ · Tuesday = A · Wednesday = B (maximum leniency) · Thursday = C · Friday = D · Saturday = F
      </div>
    </div>
  );
}
