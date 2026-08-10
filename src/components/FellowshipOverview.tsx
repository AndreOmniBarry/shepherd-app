'use client';
import type { CSSProperties } from 'react';
import UpcomingEventsCard from '@/components/UpcomingEventsCard';
import AttendanceHistoryPanel from '@/components/AttendanceHistoryPanel';

// Fellowship's dedicated overview tab, extracted out of the ~1,100-line
// fellowship/page.tsx where it used to live as inline JSX.
//
// This is intentionally NOT StructureOverview (the component shared by
// Cell and Department). Cell/Department overview is a member-health
// drill-down within a single unit, backed by a single endpoint
// (/api/cell/overview, /api/department/overview) that returns per-member
// attendance rate, consecutive-absence streaks, and SLA history. A
// fellowship is a rollup of many cells, and no endpoint today computes
// that same member-health shape at the fellowship level — this component
// shows what fellowship's overview actually has: per-cell submission
// status, fellowship-wide KPIs, and the fellowship's attendance trend
// (via the already-shared AttendanceHistoryPanel). Forcing it into
// StructureOverview's data contract would mean inventing member-health
// data fellowship's endpoints don't compute, which is Phase 2+ (API)
// territory, not this pass. See the phase-1 report for the full note.
//
// Data (cells, KPIs, giving) is passed down from fellowship/page.tsx
// rather than fetched here, because that state is already shared with
// the Cells/Giving tabs — self-fetching here would create a second,
// independently-stale copy of the same data.

type OverviewCell = {
  id: string;
  name: string;
  leader_name: string;
  sla_grade?: string;
  status: 'submitted' | 'pending' | 'overdue';
};

interface FellowshipOverviewProps {
  t: Record<string, string>;
  isMobile?: boolean;
  leaderName: string;
  tier2Label: string;
  cells: OverviewCell[];
  totalMembers: number;
  avgRate: number;
  submittedCells: number;
  pendingCells: number;
  overdueCells: number;
  ytdGiving: number;
  formatGiving: (n: number) => string;
  onNudgeSent: (message: string) => void;
  onViewCells: () => void;
}

export default function FellowshipOverview({
  t, isMobile = false, leaderName, tier2Label, cells, totalMembers, avgRate,
  submittedCells, pendingCells, overdueCells, ytdGiving, formatGiving, onNudgeSent, onViewCells,
}: FellowshipOverviewProps) {
  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const card = (extra?: CSSProperties): CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`,
    borderRadius: 12, padding: '16px 18px', ...extra,
  });

  async function nudgeAll() {
    const pendingLeaders = cells.filter(c => c.status !== 'submitted');
    await fetch('/api/notify/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: 'nudge_submission', cells: pendingLeaders.map(c => c.id) }),
    });
    onNudgeSent(`Nudge sent to ${pendingLeaders.length} cell leader${pendingLeaders.length > 1 ? 's' : ''}`);
  }

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
          {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}{leaderName ? `, ${leaderName.split(' ')[0]}` : ''}
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }} suppressHydrationWarning>{todayStr}</div>
      </div>

      {/* Submission status banner with nudge button */}
      <div style={{ background: overdueCells > 0 ? t.coralBg : pendingCells > 0 ? t.amberBg : t.tealBg, borderRadius: 10, padding: '10px 14px', marginBottom: 18, border: `0.5px solid ${overdueCells > 0 ? 'rgba(216,90,48,0.2)' : pendingCells > 0 ? 'rgba(186,117,23,0.2)' : 'rgba(29,158,117,0.2)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: overdueCells > 0 ? t.coral : pendingCells > 0 ? t.amber : t.teal, fontWeight: 500 }}>
          {overdueCells > 0
            ? `${overdueCells} cell${overdueCells > 1 ? 's' : ''} overdue — submission window closing soon`
            : pendingCells > 0
            ? `${pendingCells} cell${pendingCells > 1 ? 's' : ''} pending — remind your leaders to submit`
            : `All ${submittedCells} cells submitted for this Sunday`}
        </div>
        {(pendingCells > 0 || overdueCells > 0) && (
          <button onClick={nudgeAll}
            style={{ background: overdueCells > 0 ? '#D85A30' : '#BA7517', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 10 }}>
            Nudge all
          </button>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <UpcomingEventsCard t={t} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Total members', value: totalMembers, accent: '#534AB7', sub: `${cells.length} cells` },
          { label: 'Avg attendance', value: `${avgRate}%`, accent: '#1D9E75', sub: 'Last Sunday' },
          { label: 'Submitted', value: `${submittedCells}/${cells.length}`, accent: '#BA7517', sub: 'This Sunday' },
          { label: 'YTD giving', value: formatGiving(ytdGiving), accent: '#D85A30', sub: 'All types' },
        ].map(k => (
          <div key={k.label} style={{ ...card(), borderTop: `2.5px solid ${k.accent}` }}>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.text, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Cells needing attention */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        <div style={card()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{tier2Label} submission status</span>
            <span style={{ fontSize: 11, color: t.purple, cursor: 'pointer' }} onClick={onViewCells}>View all</span>
          </div>
          {cells.slice(0, 6).map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `0.5px solid ${t.border}` }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{c.name}</div>
                <div style={{ fontSize: 10, color: t.muted }}>{c.leader_name}</div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: c.status === 'submitted' ? t.tealBg : c.status === 'pending' ? t.amberBg : t.coralBg, color: c.status === 'submitted' ? t.teal : c.status === 'pending' ? t.amber : t.coral }}>
                {c.status === 'submitted' ? `Submitted · ${c.sla_grade || ''}` : c.status === 'pending' ? 'Pending' : 'Overdue'}
              </span>
            </div>
          ))}
          {cells.length === 0 && (
            <div style={{ padding: '16px 0', textAlign: 'center', color: t.muted, fontSize: 12 }}>No cells assigned to your fellowship yet.</div>
          )}
        </div>

        <div style={card()}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Attendance trend</div>
          <AttendanceHistoryPanel t={t} fetchUrl={(g, o) => `/api/fellowship/history?granularity=${g}&offset=${o}`} color={t.purple} />
        </div>
      </div>
    </div>
  );
}
