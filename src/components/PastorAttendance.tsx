'use client';
import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type CellStatus = {
  cell_id: string; cell_name: string; fellowship_name: string;
  sunday_submitted: boolean; sunday_present: number; sunday_absent: number; sunday_sla: string | null;
  midweek_submitted: boolean; midweek_present: number; midweek_sla: string | null;
};

type TrendPoint = { week: string; date: string; present: number; absent: number; rate: number; cells_submitted: number };
type DeptStatus = { dept_id: string; dept_name: string; submitted: boolean; present: number; absent: number; sla: string | null };
type FellowshipSummary = { fellowship_id: string; fellowship_name: string; total_cells: number; submitted_cells: number; total_present: number; completion_rate: number };

type AttendanceData = {
  latest_sunday: { id: string; service_date: string } | null;
  latest_midweek: { id: string; service_date: string } | null;
  sunday_trend: TrendPoint[];
  midweek_trend: TrendPoint[];
  cell_submission_status: CellStatus[];
  dept_status: DeptStatus[];
  fellowship_summary: FellowshipSummary[];
  total_cells: number;
  cells_submitted_sunday: number;
  cells_submitted_midweek: number;
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

interface PastorAttendanceProps {
  dark: boolean;
  t: Record<string, string>;
}

export default function PastorAttendance({ dark, t }: PastorAttendanceProps) {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'sunday' | 'midweek'>('sunday');
  const [cellSearch, setCellSearch] = useState('');
  const [fellowshipFilter, setFellowshipFilter] = useState('all');

  useEffect(() => {
    fetch('/api/analytics/attendance', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data) setData(data); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Auto-refresh every 60 seconds — v2
    const interval = setInterval(() => {
      fetch('/api/analytics/attendance', { credentials: 'include' })
        .then(r => r.json())
        .then(({ data }) => { if (data) setData(data); })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: t.muted, fontSize: 13 }}>Loading attendance intelligence...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 60, color: t.muted, fontSize: 13 }}>No attendance data available.</div>;

  const trend = view === 'sunday' ? data.sunday_trend : data.midweek_trend;
  const latestService = view === 'sunday' ? data.latest_sunday : data.latest_midweek;
  const cellsSubmitted = view === 'sunday' ? data.cells_submitted_sunday : data.cells_submitted_midweek;

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const [yr, mo, dy] = dateStr.split('-').map(Number);
    const date = new Date(yr, mo - 1, dy);
    return `${dy} ${MONTH_NAMES[mo-1]} ${yr}`;
  };

  const fellowships = [...new Set(data.cell_submission_status.map(c => c.fellowship_name))].filter(f => f !== '—');

  const filteredCells = data.cell_submission_status.filter(c => {
    const matchSearch = cellSearch ? c.cell_name.toLowerCase().includes(cellSearch.toLowerCase()) : true;
    const matchFellowship = fellowshipFilter !== 'all' ? c.fellowship_name === fellowshipFilter : true;
    return matchSearch && matchFellowship;
  });

  const latestTrend = trend[trend.length - 1];
  const totalPresent = data.cell_submission_status.reduce((a, c) => a + (view === 'sunday' ? c.sunday_present : c.midweek_present), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Service toggle */}
      <div style={{ display: 'flex', background: t.input, borderRadius: 10, padding: 4, border: `0.5px solid ${t.border}`, maxWidth: 300 }}>
        {[{ id: 'sunday', label: 'Sunday Service' }, { id: 'midweek', label: 'Wednesday Midweek' }].map(v => (
          <button key={v.id} onClick={() => setView(v.id as typeof view)}
            style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: view === v.id ? 600 : 400, background: view === v.id ? t.card : 'transparent', color: view === v.id ? t.purple : t.sub, transition: 'all 0.15s' }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Current service info */}
      {latestService && (
        <div style={{ background: t.purpleBg, borderRadius: 10, padding: '11px 14px', border: `0.5px solid rgba(83,74,183,0.15)`, fontSize: 12, color: t.purple }}>
          Latest {view === 'sunday' ? 'Sunday' : 'Wednesday'}: <strong>{formatDate(latestService.service_date)}</strong> · {cellsSubmitted}/{data.total_cells} cells submitted · {totalPresent} total present
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Cells submitted', value: `${cellsSubmitted}/${data.total_cells}`, sub: `${Math.round((cellsSubmitted / Math.max(1, data.total_cells)) * 100)}% completion`, accent: '#534AB7' },
          { label: 'Total present', value: totalPresent, sub: 'This service', accent: '#1D9E75' },
          { label: 'Avg attendance rate', value: latestTrend && latestTrend.present > 0 ? `${latestTrend.rate}%` : '—', sub: 'Latest service', accent: '#BA7517' },
          { label: 'Cells pending', value: data.total_cells - cellsSubmitted, sub: 'Not yet submitted', accent: data.total_cells - cellsSubmitted > 0 ? '#D85A30' : '#1D9E75' },
        ].map(k => (
          <div key={k.label} style={{ background: t.card, borderRadius: 11, border: `0.5px solid ${t.border}`, padding: '12px 14px', borderTop: `2.5px solid ${k.accent}` }}>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.text, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Trend chart */}
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>{view === 'sunday' ? 'Sunday' : 'Wednesday'} attendance trend</div>
          <div style={{ fontSize: 10, color: t.muted, marginBottom: 12 }}>Last {trend.length} services</div>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#534AB7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#534AB7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#2A2A2A' : '#F0F0F0'} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: dark ? '#888' : '#6B7280' }} />
                <YAxis tick={{ fontSize: 9, fill: dark ? '#888' : '#6B7280' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: t.card, color: t.text }}
                  formatter={(v: number, name: string) => [v, name === 'present' ? 'Present' : name === 'absent' ? 'Absent' : name]} />
                <Area type="monotone" dataKey="present" stroke="#1D9E75" strokeWidth={2} fill="url(#attGrad)" name="present" />
                <Area type="monotone" dataKey="absent" stroke="#D85A30" strokeWidth={1.5} fill="none" name="absent" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 12 }}>No data yet</div>
          )}
        </div>

        {/* Fellowship summary */}
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Fellowship submission status</div>
          {data.fellowship_summary.length === 0 ? (
            <div style={{ color: t.muted, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No data</div>
          ) : (
            data.fellowship_summary.map((fel, i) => (
              <div key={fel.fellowship_id} style={{ marginBottom: i < data.fellowship_summary.length - 1 ? 10 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{fel.fellowship_name}</span>
                  <span style={{ fontSize: 11, color: t.muted }}>{fel.total_cells === 0 ? 'Direct headcount' : `${fel.submitted_cells}/${fel.total_cells} cells · ${fel.total_present} present`}</span>
                </div>
                <div style={{ height: 5, background: t.input, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${fel.completion_rate}%`, background: fel.completion_rate === 100 ? '#1D9E75' : fel.completion_rate >= 50 ? '#BA7517' : '#D85A30', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Department attendance */}
      {data.dept_status.length > 0 && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${t.border}`, fontSize: 12, fontWeight: 600, color: t.text }}>
            Department attendance — {view === 'sunday' ? 'Sunday' : 'Wednesday'}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                {['Department', 'Status', 'Present', 'Absent', 'SLA'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.dept_status.map((d, i) => {
                const slaC = d.sla ? SLA_CFG[d.sla] : null;
                return (
                  <tr key={d.dept_id} style={{ borderBottom: i < data.dept_status.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: t.text }}>{d.dept_name}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: d.submitted ? t.tealBg : t.coralBg, color: d.submitted ? t.teal : t.coral, fontWeight: 500 }}>
                        {d.submitted ? 'Submitted' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: t.teal, fontWeight: 500 }}>{d.present}</td>
                    <td style={{ padding: '9px 12px', color: d.absent > 0 ? t.coral : t.muted }}>{d.absent}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {slaC ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: slaC.bg, color: slaC.text, fontWeight: 600 }}>{d.sla}</span> : <span style={{ color: t.muted }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cell submission status */}
      <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Cell submission status</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={cellSearch} onChange={e => setCellSearch(e.target.value)} placeholder="Search cell..."
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '5px 10px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }} />
            <select value={fellowshipFilter} onChange={e => setFellowshipFilter(e.target.value)}
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '5px 10px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }}>
              <option value="all">All fellowships</option>
              {fellowships.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
              {['Cell', 'Fellowship', view === 'sunday' ? 'Sunday status' : 'Midweek status', 'Present', 'Absent', 'SLA'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredCells.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>No cells found.</td></tr>
            ) : (
              filteredCells.map((c, i) => {
                const submitted = view === 'sunday' ? c.sunday_submitted : c.midweek_submitted;
                const present = view === 'sunday' ? c.sunday_present : c.midweek_present;
                const absent = view === 'sunday' ? c.sunday_absent : 0;
                const sla = view === 'sunday' ? c.sunday_sla : c.midweek_sla;
                const slaC = sla ? SLA_CFG[sla] : null;
                return (
                  <tr key={c.cell_id} style={{ borderBottom: i < filteredCells.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: t.text }}>{c.cell_name}</td>
                    <td style={{ padding: '9px 12px', color: t.muted, fontSize: 11 }}>{c.fellowship_name}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: submitted ? t.tealBg : t.coralBg, color: submitted ? t.teal : t.coral, fontWeight: 500 }}>
                        {submitted ? 'Submitted' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: t.teal, fontWeight: 500 }}>{submitted ? present : '—'}</td>
                    <td style={{ padding: '9px 12px', color: absent > 0 ? t.coral : t.muted }}>{submitted ? absent : '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {slaC ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: slaC.bg, color: slaC.text, fontWeight: 600 }}>{sla}</span> : <span style={{ color: t.muted }}>—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
