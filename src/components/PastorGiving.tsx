'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type GivingData = {
  kpi: { ytd: number; mtd: number; wtd: number; today: number; yoy_growth: number | null; last_year: number };
  monthly_trend: Array<{ month: string; label: string; total: number; [key: string]: number | string }>;
  weekly_trend: Array<{ week: string; date: string; total: number }>;
  by_type: Array<{ id: string; name: string; category: string; total: number; pct: number }>;
  income_types: Array<{ id: string; name: string; category: string }>;
  recent_entries: Array<{ id: string; amount: number; service_date: string; member_name: string; income_type: string; notes: string; created_at: string }>;
  total_entries: number;
};

const TYPE_COLORS = ['#534AB7','#1D9E75','#BA7517','#D85A30','#9C27B0','#E91E63','#00BCD4','#FF5722'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface PastorGivingProps { dark: boolean; t: Record<string, string>; }

export default function PastorGiving({ dark, t }: PastorGivingProps) {
  const [data, setData] = useState<GivingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'day' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`);
  const [range, setRange] = useState<'3m' | '6m' | '1y'>('6m');

  const fmtNGN = (n: number) => n >= 1e9 ? `₦${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `₦${(n/1e6).toFixed(2)}M` : `₦${Math.round(n).toLocaleString('en-NG')}`;
  const fmtDate = (d: string) => { const [y,mo,dy] = d.split('-').map(Number); return `${dy} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo-1]}`; };

  useEffect(() => {
    fetch('/api/analytics/giving', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data) setData(data); })
      .catch(() => {})
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch('/api/analytics/giving', { credentials: 'include' })
        .then(r => r.json())
        .then(({ data }) => { if (data) setData(data); })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: t.muted, fontSize: 13 }}>Loading giving intelligence...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 60, color: t.muted, fontSize: 13 }}>No giving data available.</div>;

  const monthsToShow = range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const chartData = data.monthly_trend.slice(-monthsToShow);

  // Get top 4 income types for stacked chart
  const topTypes = data.by_type.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* View toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: t.input, borderRadius: 10, padding: 3, border: `0.5px solid ${t.border}`, gap: 2 }}>
          {[{ id: 'month', label: 'Monthly' }, { id: 'week', label: 'Weekly' }, { id: 'day', label: 'Today' }, { id: 'custom', label: 'By Month' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id as typeof view)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: view === v.id ? 600 : 400, background: view === v.id ? (dark ? 'rgba(83,74,183,0.5)' : '#534AB7') : 'transparent', color: view === v.id ? '#fff' : t.sub, transition: 'all 0.15s', fontFamily: 'inherit' }}>
              {v.label}
            </button>
          ))}
        </div>
        {view === 'month' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ id: '3m', label: '3M' }, { id: '6m', label: '6M' }, { id: '1y', label: '1Y' }].map(r => (
              <button key={r.id} onClick={() => setRange(r.id as typeof range)}
                style={{ padding: '5px 12px', borderRadius: 20, border: `0.5px solid ${range === r.id ? '#534AB7' : t.border}`, cursor: 'pointer', fontSize: 11, background: range === r.id ? '#534AB7' : 'transparent', color: range === r.id ? '#fff' : t.sub, fontFamily: 'inherit' }}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Today', value: fmtNGN(data.kpi.today), sub: 'Live', accent: '#1D9E75', bg: t.tealBg },
          { label: 'This week', value: fmtNGN(data.kpi.wtd), sub: 'Week to date', accent: '#534AB7', bg: t.purpleBg },
          { label: 'This month', value: fmtNGN(data.kpi.mtd), sub: 'Month to date', accent: '#BA7517', bg: t.amberBg },
          { label: 'YTD total', value: fmtNGN(data.kpi.ytd), sub: data.kpi.yoy_growth !== null ? `${data.kpi.yoy_growth >= 0 ? '+' : ''}${data.kpi.yoy_growth}% vs last year` : `${data.total_entries} entries`, accent: '#534AB7', bg: t.purpleBg },
        ].map(k => (
          <div key={k.label} style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px', borderTop: `2.5px solid ${k.accent}` }}>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.text, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Main chart */}
      {view === 'month' && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Monthly giving — {new Date().getFullYear()}</div>
          <div style={{ fontSize: 11, color: t.muted, marginBottom: 14 }}>{monthsToShow} months · all income types</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(168,159,255,0.06)' : '#F0EEF9'} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: dark ? 'rgba(168,159,255,0.5)' : '#9990CC' }} />
              <YAxis tick={{ fontSize: 10, fill: dark ? 'rgba(168,159,255,0.5)' : '#9990CC' }} tickFormatter={v => `₦${(v/1000000).toFixed(1)}M`} width={48} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, background: t.card, color: t.text, border: `0.5px solid ${t.border}` }}
                formatter={(v: number) => [fmtNGN(v), '']}
              />
              {topTypes.length > 0 ? (
                topTypes.map((type, i) => (
                  <Bar key={type.id} dataKey={type.id} name={type.name} fill={TYPE_COLORS[i]} radius={i === topTypes.length - 1 ? [3,3,0,0] : [0,0,0,0]} stackId="a" />
                ))
              ) : (
                <Bar dataKey="total" fill="#534AB7" radius={[3,3,0,0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
          {topTypes.length > 0 && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
              {topTypes.map((type, i) => (
                <div key={type.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.sub }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLORS[i], flexShrink: 0 }} />
                  {type.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'week' && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Weekly giving — last 8 weeks</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.weekly_trend} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="wkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#534AB7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#534AB7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(168,159,255,0.06)' : '#F0EEF9'} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: dark ? 'rgba(168,159,255,0.5)' : '#9990CC' }} />
              <YAxis tick={{ fontSize: 10, fill: dark ? 'rgba(168,159,255,0.5)' : '#9990CC' }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} width={48} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: t.card, color: t.text, border: `0.5px solid ${t.border}` }} formatter={(v: number) => [fmtNGN(v), 'Total']} />
              <Area type="monotone" dataKey="total" stroke="#534AB7" strokeWidth={2} fill="url(#wkGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'day' && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Today's giving</div>
          <div style={{ fontSize: 11, color: t.muted, marginBottom: 16 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          {data.kpi.today === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: t.muted, fontSize: 13 }}>No giving recorded today yet.</div>
          ) : (
            <div style={{ fontSize: 32, fontWeight: 700, color: t.teal }}>{fmtNGN(data.kpi.today)}</div>
          )}
        </div>
      )}

      {view === 'custom' && (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Month breakdown</div>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }}>
              {data.monthly_trend.filter(m => m.total > 0).map(m => (
                <option key={m.month} value={m.month}>{m.label} {m.month.split('-')[0]}</option>
              ))}
            </select>
          </div>
          {(() => {
            const monthData = data.monthly_trend.find(m => m.month === selectedMonth);
            if (!monthData) return <div style={{ color: t.muted, fontSize: 13 }}>No data for this month.</div>;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: t.teal }}>{fmtNGN(monthData.total)}</div>
                <div style={{ fontSize: 12, color: t.muted }}>Total for {monthData.label}</div>
                {data.by_type.map((type, i) => {
                  const amt = (monthData[type.id] as number) || 0;
                  if (!amt) return null;
                  const pct = monthData.total > 0 ? Math.round((amt / (monthData.total as number)) * 100) : 0;
                  return (
                    <div key={type.id} style={{ marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: t.text }}>{type.name}</span>
                        <span style={{ fontSize: 11, color: t.muted }}>{fmtNGN(amt)} · {pct}%</span>
                      </div>
                      <div style={{ height: 5, background: dark ? 'rgba(255,255,255,0.06)' : '#F0EEF9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: TYPE_COLORS[i % TYPE_COLORS.length], borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
      {/* By type breakdown + recent entries */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* By type */}
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>YTD by income type</div>
          {data.by_type.length === 0 ? (
            <div style={{ color: t.muted, fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No data yet</div>
          ) : (
            data.by_type.map((type, i) => (
              <div key={type.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: t.text }}>{type.name}</span>
                  <span style={{ fontSize: 11, color: t.muted }}>{fmtNGN(type.total)} · {type.pct}%</span>
                </div>
                <div style={{ height: 5, background: dark ? 'rgba(255,255,255,0.06)' : '#F0EEF9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${type.pct}%`, height: '100%', background: TYPE_COLORS[i % TYPE_COLORS.length], borderRadius: 3, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent entries */}
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${t.border}`, fontSize: 12, fontWeight: 600, color: t.text }}>Recent entries</div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {data.recent_entries.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>No entries yet</div>
            ) : (
              data.recent_entries.map((entry, i) => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < data.recent_entries.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                  <div>
                    <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{entry.member_name}</div>
                    <div style={{ fontSize: 10, color: t.muted }}>{entry.income_type} · {fmtDate(entry.service_date as string)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.teal }}>{fmtNGN(entry.amount)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
