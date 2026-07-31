'use client';
import { useState, useEffect } from 'react';
import TotalHistoryPanel from '@/components/TotalHistoryPanel';

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

interface PastorGivingProps { dark: boolean; t: Record<string, string>; branchId?: string; }

export default function PastorGiving({ dark, t, branchId }: PastorGivingProps) {
  const [data, setData] = useState<GivingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fmtNGN = (n: number) => n >= 1e9 ? `₦${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `₦${(n/1e6).toFixed(2)}M` : `₦${Math.round(n).toLocaleString('en-NG')}`;
  const fmtDate = (d: string) => { const [y,mo,dy] = d.split('-').map(Number); return `${dy} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo-1]}`; };

  useEffect(() => {
    setLoading(true);
    const bq = branchId ? `?branch_id=${branchId}` : '';
    fetch(`/api/analytics/giving${bq}`, { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data) setData(data); })
      .catch(() => {})
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch(`/api/analytics/giving${bq}`, { credentials: 'include' })
        .then(r => r.json())
        .then(({ data }) => { if (data) setData(data); })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [branchId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: t.muted, fontSize: 13 }}>Loading giving intelligence...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 60, color: t.muted, fontSize: 13 }}>No giving data available.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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

      {/* Statement — one pager, week/month/year, Previous/Next, no separate
          "Today"/"By Month" modes to keep track of; Today is already in the
          KPI row above and month totals are just the By Month granularity. */}
      <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Statement</div>
        <TotalHistoryPanel t={t} color="#534AB7" valueLabel="Giving" formatValue={fmtNGN} defaultGranularity="month"
          fetchUrl={(g, o) => `/api/analytics/giving/history?granularity=${g}&offset=${o}${branchId ? `&branch_id=${branchId}` : ''}`}
          emptyText="No giving recorded for this window yet." />
      </div>

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
