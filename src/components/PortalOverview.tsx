'use client';

interface PortalOverviewProps {
  role: 'cell_leader' | 'fellowship_head' | 'department_head' | 'care_team';
  name: string;
  dark?: boolean;
  t: Record<string, string>;
  stats: {
    slaGrade?: string;
    lastSubmission?: string;
    attendanceRate?: number;
    totalMembers?: number;
    pendingLeads?: number;
    firstTimers?: number;
    insight?: string;
  };
}

const SLA_COLORS: Record<string, { bg: string; text: string }> = {
  'A+': { bg: '#E1F5EE', text: '#085041' },
  'A':  { bg: '#E1F5EE', text: '#085041' },
  'B':  { bg: '#EEEDFE', text: '#3C3489' },
  'C':  { bg: '#FAEEDA', text: '#633806' },
  'D':  { bg: '#FAECE7', text: '#993C1D' },
  'F':  { bg: '#FCEBEB', text: '#A32D2D' },
  'F-': { bg: '#FCEBEB', text: '#A32D2D' },
};

const TIER_LABELS: Record<string, string> = {
  'A+': 'Crown of Excellence pace',
  'A':  'Elite Shepherd pace',
  'B':  'Faithful Steward pace',
  'C':  'Needs improvement',
  'D':  'Pastoral review threshold',
  'F':  'Alert — no submission',
  'F-': 'Critical — overdue',
};

export default function PortalOverview({ role, name, dark = false, t, stats }: PortalOverviewProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = name.split(' ')[0];

  const roleLabel = role === 'cell_leader' ? 'Cell Leader'
    : role === 'fellowship_head' ? 'Fellowship Head'
    : role === 'department_head' ? 'Department Head'
    : 'Care Team';

  const sla = stats.slaGrade || '—';
  const slaColor = SLA_COLORS[sla] || { bg: t.purpleBg, text: t.purple };
  const tier = TIER_LABELS[sla] || 'No submission yet this week';

  const kpis = role === 'cell_leader' ? [
    { label: 'SLA grade', value: sla, sub: tier, valueBg: slaColor.bg, valueColor: slaColor.text },
    { label: 'Attendance rate', value: stats.attendanceRate ? `${stats.attendanceRate}%` : '—', sub: 'Last Sunday', valueBg: t.tealBg, valueColor: t.teal },
    { label: 'Cell members', value: stats.totalMembers ?? '—', sub: 'Active roster', valueBg: t.purpleBg, valueColor: t.purple },
  ] : role === 'fellowship_head' ? [
    { label: 'SLA grade', value: sla, sub: tier, valueBg: slaColor.bg, valueColor: slaColor.text },
    { label: 'Fellowship rate', value: stats.attendanceRate ? `${stats.attendanceRate}%` : '—', sub: 'Last Sunday', valueBg: t.tealBg, valueColor: t.teal },
    { label: 'Total members', value: stats.totalMembers ?? '—', sub: 'All cells', valueBg: t.purpleBg, valueColor: t.purple },
  ] : role === 'department_head' ? [
    { label: 'SLA grade', value: sla, sub: tier, valueBg: slaColor.bg, valueColor: slaColor.text },
    { label: 'Dept attendance', value: stats.attendanceRate ? `${stats.attendanceRate}%` : '—', sub: 'Last Sunday', valueBg: t.tealBg, valueColor: t.teal },
    { label: 'Dept members', value: stats.totalMembers ?? '—', sub: 'Active roster', valueBg: t.purpleBg, valueColor: t.purple },
  ] : [
    { label: 'Open leads', value: stats.pendingLeads ?? '—', sub: 'Needs contact', valueBg: t.amberBg, valueColor: t.amber },
    { label: 'First timers', value: stats.firstTimers ?? '—', sub: 'This month', valueBg: t.tealBg, valueColor: t.teal },
    { label: 'SLA grade', value: sla, sub: tier, valueBg: slaColor.bg, valueColor: slaColor.text },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }} suppressHydrationWarning>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {roleLabel}
        </div>
      </div>

      {/* Insight banner */}
      {stats.insight && (
        <div style={{ background: t.purpleBg, border: `0.5px solid rgba(83,74,183,0.15)`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: t.purple, lineHeight: 1.5 }}>
          {stats.insight}
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: t.card, borderRadius: 11, border: `0.5px solid ${t.border}`, padding: '12px 14px', borderTop: `2.5px solid ${k.valueColor}` }}>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.valueColor, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: t.muted, marginTop: 4, lineHeight: 1.4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Last submission */}
      {stats.lastSubmission && (
        <div style={{ marginTop: 10, fontSize: 11, color: t.muted, textAlign: 'right' }}>
          Last submission: {new Date(stats.lastSubmission).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      )}
    </div>
  );
}
