'use client';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import UpcomingEventsCard from '@/components/UpcomingEventsCard';
import Icon from '@/components/Icon';
import { SkeletonCard, SkeletonRow } from '@/components/Skeleton';

// Shared overview tab for any single attendance-tracking unit (a cell, a
// department, …) that reports member-level attendance health. Cell and
// Department used to be two ~90%-identical copy-pasted components; this is
// the one implementation, parameterized the same way AttendanceHistoryPanel
// is — a fetch URL plus a handful of labels, not a type switch inside.
//
// Fellowship is NOT wired to this component. Its "overview" is a rollup
// across many cells (submission status per cell, fellowship-wide giving)
// rather than member-level health within one unit, and no endpoint today
// returns fellowship data in this shape — see the note in fellowship's
// page.tsx above its own overview section.

type MemberProfile = {
  id: string;
  full_name: string;
  role?: string;
  present: number;
  absent: number;
  total: number;
  rate: number | null;
  consecutiveAbsences: number;
  lastSeen?: string;
  health: 'healthy' | 'fair' | 'low' | 'watch' | 'warning' | 'critical' | 'new';
  birthdayStatus?: string | null;
};

type Action = { priority: 'high' | 'medium' | 'low'; message: string };

type UnitInfo = { id: string; name: string; fellowship?: string; totalMembers: number };

type Stats = {
  avgRate: number | null;
  currentSLA: string | null;
  // Cell's endpoint reports these; Department's does not (its criticalCount
  // already folds warning-tier members in). Rendered only when present.
  bestSunday?: { date: string; rate: number } | null;
  worstSunday?: { date: string; rate: number } | null;
  warningCount?: number;
  totalSubmissions: number;
  criticalCount: number;
};

type Overview = {
  cell?: UnitInfo;
  dept?: UnitInfo;
  stats: Stats;
  trend: { week: string; present: number; absent: number; rate: number; sla: string; date: string }[];
  memberProfiles: MemberProfile[];
  slaHistory: { date: string; grade: string }[];
  actions: Action[];
  birthdayToday: MemberProfile[];
  // Only Cell's endpoint returns this today.
  upcomingBirthdays?: MemberProfile[];
};

const HEALTH_CFG: Record<string, { bg: string; text: string; label: string; border: string }> = {
  healthy:  { bg: '#E1F5EE', text: '#085041', label: 'Healthy',  border: '#1D9E75' },
  fair:     { bg: '#EEEDFE', text: '#3C3489', label: 'Fair',     border: '#534AB7' },
  low:      { bg: '#FAEEDA', text: '#633806', label: 'Low',      border: '#BA7517' },
  watch:    { bg: '#FAEEDA', text: '#633806', label: 'Watch',    border: '#BA7517' },
  warning:  { bg: '#FAECE7', text: '#993C1D', label: 'Warning',  border: '#D85A30' },
  critical: { bg: '#FCEBEB', text: '#A32D2D', label: 'Critical', border: '#C62828' },
  new:      { bg: '#F3F4F6', text: '#6B7280', label: 'New',      border: '#9CA3AF' },
};

const SLA_CFG: Record<string, { bg: string; text: string }> = {
  'A+': { bg: '#E1F5EE', text: '#085041' },
  'A':  { bg: '#E1F5EE', text: '#085041' },
  'B':  { bg: '#EEEDFE', text: '#3C3489' },
  'C':  { bg: '#FAEEDA', text: '#633806' },
  'D':  { bg: '#FAECE7', text: '#993C1D' },
  'F':  { bg: '#FCEBEB', text: '#A32D2D' },
  'F-': { bg: '#FCEBEB', text: '#A32D2D' },
};

const ACTION_CFG = {
  high:   { bg: '#FCEBEB', text: '#A32D2D', border: 'rgba(198,40,40,0.2)', icon: '⚠' },
  medium: { bg: '#FAEEDA', text: '#633806', border: 'rgba(186,117,23,0.2)', icon: '●' },
  low:    { bg: '#EEEDFE', text: '#3C3489', border: 'rgba(83,74,183,0.2)',  icon: '○' },
};

interface StructureOverviewProps {
  dark?: boolean;
  t: Record<string, string>;
  isMobile?: boolean;
  /** e.g. '/api/cell/overview' or '/api/department/overview' */
  fetchUrl: string;
  /** Which key in the response holds the unit's own info block. */
  structureKey: 'cell' | 'dept';
  /** e.g. 'Cell' or 'Department' — used for the members KPI label. */
  unitLabel: string;
  emptyTitle: string;
  emptySubtitle?: string;
}

export default function StructureOverview({ dark = false, t, isMobile = false, fetchUrl, structureKey, unitLabel, emptyTitle, emptySubtitle }: StructureOverviewProps) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberView, setMemberView] = useState<'all' | 'critical' | 'watch' | 'healthy'>('all');

  useEffect(() => {
    setOverview(null);
    setLoading(true);
    fetch(fetchUrl, { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data) setOverview(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchUrl]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 10 }}>
        {[0, 1, 2].map(i => <SkeletonCard key={i} lines={1} />)}
      </div>
      <SkeletonCard>
        {Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}
      </SkeletonCard>
    </div>
  );

  const unit = overview ? (structureKey === 'cell' ? overview.cell : overview.dept) : undefined;

  if (!overview || !unit) return (
    <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: t.sub }}>{emptyTitle}</div>
      {emptySubtitle && <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{emptySubtitle}</div>}
    </div>
  );

  const { stats, trend, memberProfiles, slaHistory, actions, birthdayToday, upcomingBirthdays } = overview;
  const slaColor = SLA_CFG[stats.currentSLA || ''] || { bg: t.purpleBg, text: t.purple };
  const atRisk = stats.criticalCount + (stats.warningCount ?? 0);
  const atRiskSub = stats.warningCount !== undefined
    ? `${stats.criticalCount} critical · ${stats.warningCount} warning`
    : 'Need follow-up';
  const hasRoleColumn = memberProfiles.some(m => m.role);

  const filteredMembers = memberProfiles.filter(m =>
    memberView === 'all' ? true
    : memberView === 'critical' ? ['critical', 'warning'].includes(m.health)
    : memberView === 'watch' ? m.health === 'watch'
    : ['healthy', 'fair'].includes(m.health)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <UpcomingEventsCard t={t} />

      {/* Action items */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {actions.map((a, i) => {
            const cfg = ACTION_CFG[a.priority];
            return (
              <div key={i} style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 9, padding: '10px 13px', fontSize: 12, color: cfg.text, display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, fontWeight: 700 }}>{cfg.icon}</span>
                {a.message}
              </div>
            );
          })}
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: `${unitLabel} members`, value: unit.totalMembers, sub: unit.fellowship ? `${unit.fellowship} Fellowship` : unit.name, accent: '#534AB7' },
          { label: 'Avg attendance', value: stats.avgRate !== null ? `${stats.avgRate}%` : '—', sub: 'Last 8 Sundays', accent: '#1D9E75' },
          { label: 'Current SLA', value: stats.currentSLA || '—', sub: 'This week', accent: slaColor.text, valueBg: slaColor.bg, valueText: slaColor.text },
          { label: 'Members at risk', value: atRisk, sub: atRiskSub, accent: atRisk > 0 ? '#D85A30' : '#1D9E75' },
        ].map(k => (
          <div key={k.label} style={{ background: t.card, borderRadius: 11, border: `0.5px solid ${t.border}`, padding: '12px 14px', borderTop: `2.5px solid ${k.accent}` }}>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.valueText || t.text, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: t.muted, marginTop: 4, lineHeight: 1.4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>

        {/* Attendance trend */}
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Attendance trend</div>
          <div style={{ fontSize: 10, color: t.muted, marginBottom: 12 }}>
            {stats.bestSunday || stats.worstSunday
              ? <>Best: {stats.bestSunday ? `${stats.bestSunday.rate}%` : '—'} · Worst: {stats.worstSunday ? `${stats.worstSunday.rate}%` : '—'}</>
              : 'Last 8 Sundays'}
          </div>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="structureOverviewFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#534AB7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#534AB7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(168,159,255,0.06)' : '#F0EEF9'} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: dark ? 'rgba(168,159,255,0.35)' : '#9990CC' }} />
                <YAxis tick={{ fontSize: 9, fill: dark ? 'rgba(168,159,255,0.35)' : '#9990CC' }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text }}
                  formatter={(v: number) => [`${v}%`, 'Rate']}
                />
                <Area type="monotone" dataKey="rate" stroke="#534AB7" strokeWidth={2} fill="url(#structureOverviewFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>No data yet</div>
          )}
        </div>

        {/* SLA history */}
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>SLA history</div>
          <div style={{ fontSize: 10, color: t.muted, marginBottom: 12 }}>Submission timeliness — last 8 Sundays</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {slaHistory.length === 0 ? (
              <div style={{ color: t.muted, fontSize: 12, padding: '20px 0', textAlign: 'center' }}>No submissions yet</div>
            ) : (
              slaHistory.slice(0, 6).map((s, i) => {
                const sc = SLA_CFG[s.grade] || { bg: t.purpleBg, text: t.purple };
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < 5 ? `0.5px solid ${t.border}` : 'none' }}>
                    <div style={{ fontSize: 11, color: t.sub }}>{s.date ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div>
                    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: sc.bg, color: sc.text, fontWeight: 600 }}>{s.grade || '—'}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Member health table */}
      <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Member health</div>
            <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>Attendance consistency and risk status for each member</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'critical', label: `At risk (${atRisk})` },
              { id: 'watch', label: 'Watch' },
              { id: 'healthy', label: 'Healthy' },
            ].map(v => (
              <button key={v.id} onClick={() => setMemberView(v.id as typeof memberView)}
                style={{ padding: '4px 10px', borderRadius: 20, border: 'none', background: memberView === v.id ? '#534AB7' : t.input, color: memberView === v.id ? '#fff' : t.sub, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: memberView === v.id ? 600 : 400 }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>No members in this category</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
            {filteredMembers.map(m => {
              const hcfg = HEALTH_CFG[m.health] || HEALTH_CFG.new;
              return (
                <div key={m.id} style={{ background: t.input, borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${hcfg.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                        {m.full_name}
                        {m.birthdayStatus === 'today' && <span style={{ marginLeft: 6, display: 'inline-flex', color: t.amber, verticalAlign: 'middle' }}><Icon name="ti-cake" size={12} /></span>}
                      </div>
                      {m.role && <div style={{ fontSize: 11, color: t.muted }}>{m.role}</div>}
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: hcfg.bg, color: hcfg.text, fontWeight: 500, flexShrink: 0 }}>{hcfg.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 48, height: 4, background: dark ? '#2A2A2A' : '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${m.rate || 0}%`, height: '100%', background: m.rate && m.rate >= 80 ? '#1D9E75' : m.rate && m.rate >= 60 ? '#BA7517' : '#D85A30', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: t.text, fontWeight: 500 }}>{m.rate !== null ? `${m.rate}%` : '—'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: t.teal }}>{m.present} present</span>
                    {m.absent > 0 && <span style={{ fontSize: 11, color: t.coral }}>{m.absent} absent</span>}
                    {m.consecutiveAbsences >= 2 && (
                      <span style={{ fontSize: 10, color: t.coral, fontWeight: 600 }}>{m.consecutiveAbsences} in a row</span>
                    )}
                    {m.birthdayStatus && m.birthdayStatus !== 'today' && (
                      <span style={{ fontSize: 10, color: t.amber }}>Birthday {m.birthdayStatus}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                  {['Member', ...(hasRoleColumn ? ['Role'] : []), 'Attendance rate', 'Present', 'Absent', 'Consecutive absences', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m, i) => {
                  const hcfg = HEALTH_CFG[m.health] || HEALTH_CFG.new;
                  return (
                    <tr key={m.id} style={{ borderBottom: i < filteredMembers.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: t.text, whiteSpace: 'nowrap' }}>
                        {m.full_name}
                        {m.birthdayStatus === 'today' && <span style={{ marginLeft: 6, display: 'inline-flex', color: t.amber, verticalAlign: 'middle' }}><Icon name="ti-cake" size={12} /></span>}
                      </td>
                      {hasRoleColumn && <td style={{ padding: '10px 12px', color: t.muted, fontSize: 11 }}>{m.role || '—'}</td>}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 50, height: 4, background: dark ? '#2A2A2A' : '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${m.rate || 0}%`, height: '100%', background: m.rate && m.rate >= 80 ? '#1D9E75' : m.rate && m.rate >= 60 ? '#BA7517' : '#D85A30', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, color: t.text, fontWeight: 500 }}>{m.rate !== null ? `${m.rate}%` : '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#1D9E75', fontWeight: 500 }}>{m.present}</td>
                      <td style={{ padding: '10px 12px', color: m.absent > 0 ? '#D85A30' : t.muted }}>{m.absent}</td>
                      <td style={{ padding: '10px 12px', color: m.consecutiveAbsences >= 2 ? '#D85A30' : t.muted, fontWeight: m.consecutiveAbsences >= 2 ? 600 : 400 }}>
                        {m.consecutiveAbsences > 0 ? `${m.consecutiveAbsences} in a row` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: hcfg.bg, color: hcfg.text, fontWeight: 500 }}>{hcfg.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Birthday section */}
      {(birthdayToday.length > 0 || (upcomingBirthdays && upcomingBirthdays.length > 0)) && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Birthdays</div>
          {birthdayToday.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#FAEEDA', borderRadius: 8, marginBottom: 6 }}>
              <span style={{ color: '#BA7517', display: 'inline-flex' }}><Icon name="ti-cake" size={18} /></span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#633806' }}>{m.full_name} — Birthday today!{m.role ? ` (${m.role})` : ''}</div>
                <div style={{ fontSize: 10, color: '#BA7517' }}>Celebrate them in your next meeting or send a message</div>
              </div>
            </div>
          ))}
          {upcomingBirthdays?.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `0.5px solid ${t.border}` }}>
              <div style={{ fontSize: 12, color: t.text }}>{m.full_name}</div>
              <div style={{ fontSize: 11, color: t.purple }}>{m.birthdayStatus}</div>
            </div>
          ))}
        </div>
      )}

      {/* Summary footer */}
      <div style={{ background: t.purpleBg, borderRadius: 10, padding: '12px 14px', border: `0.5px solid rgba(83,74,183,0.15)`, fontSize: 11, color: t.purple, lineHeight: 1.6 }}>
        <strong>{unit.name}</strong>{unit.fellowship ? ` · ${unit.fellowship} Fellowship` : ''} · {unit.totalMembers} active members · {stats.totalSubmissions} submissions recorded · Average attendance {stats.avgRate !== null ? `${stats.avgRate}%` : 'not yet calculated'}
        {stats.currentSLA && ` · Current SLA grade: ${stats.currentSLA}`}
      </div>
    </div>
  );
}
