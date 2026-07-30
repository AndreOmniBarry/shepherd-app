'use client';
import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Bucket = { label: string; present: number; absent: number; rate: number };

const MAX_LOOKBACK = 24;

function hasData(buckets: Bucket[] | null): boolean {
  return !!buckets && buckets.some(b => b.present > 0 || b.absent > 0);
}

// Real, paginated attendance history — no preset "8w/3m/6m/1y" range list.
// Toggle between week/month buckets and page further back in time instead.
// "Earlier"/"Later" skip straight to the next window that actually has
// data, rather than landing on empty weeks/months one at a time. A mini
// analysis strip below the chart calls out the average, best, and weakest
// period in the current window, plus how it's trending, so this isn't just
// a chart — it says where things are going well and where they aren't.
// Reused by the cell portal, fellowship portal, and admin dashboard so every
// history view in the app behaves the same way.
export default function AttendanceHistoryPanel({ t, fetchUrl, color, metricLabel, emptyText }: { t: Record<string, string>; fetchUrl: (granularity: 'week' | 'month', offset: number) => string; color?: string; metricLabel?: string; emptyText?: string }) {
  const [granularity, setGranularity] = useState<'week' | 'month'>('week');
  const [offset, setOffset] = useState(0);
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState<'earlier' | 'later' | null>(null);

  const fetchBuckets = useCallback((g: 'week' | 'month', o: number) => {
    return fetch(fetchUrl(g, o), { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => (data?.buckets as Bucket[] | undefined) || null)
      .catch(() => null);
  }, [fetchUrl]);

  useEffect(() => {
    setLoading(true);
    fetchBuckets(granularity, offset).then(b => { setBuckets(b); setLoading(false); });
  }, [granularity, offset, fetchBuckets]);

  // Skip straight to the next window (further back, or more recent) that
  // actually has logged attendance in it — capped so a church with a long
  // dead stretch doesn't send this into dozens of blind fetches.
  async function jump(direction: 'earlier' | 'later') {
    setSearching(direction);
    let o = offset;
    for (let i = 0; i < MAX_LOOKBACK; i++) {
      o = direction === 'earlier' ? o + 1 : o - 1;
      if (o < 0) { o = 0; break; }
      const b = await fetchBuckets(granularity, o);
      if (hasData(b)) { setOffset(o); setBuckets(b); setSearching(null); return; }
      if (direction === 'later' && o === 0) break;
    }
    setOffset(o);
    setSearching(null);
  }

  const avg = buckets && buckets.length > 0 ? Math.round(buckets.reduce((s, b) => s + b.rate, 0) / buckets.length) : null;
  const best = buckets && buckets.length > 0 ? buckets.reduce((a, b) => b.rate > a.rate ? b : a) : null;
  const worst = buckets && buckets.length > 0 ? buckets.reduce((a, b) => b.rate < a.rate ? b : a) : null;
  const firstHalf = buckets ? buckets.slice(0, Math.ceil(buckets.length / 2)) : [];
  const secondHalf = buckets ? buckets.slice(Math.ceil(buckets.length / 2)) : [];
  const firstAvg = firstHalf.length ? firstHalf.reduce((s, b) => s + b.rate, 0) / firstHalf.length : 0;
  const secondAvg = secondHalf.length ? secondHalf.reduce((s, b) => s + b.rate, 0) / secondHalf.length : 0;
  const trendUp = buckets && buckets.length >= 4 ? secondAvg > firstAvg + 2 : null;
  const trendDown = buckets && buckets.length >= 4 ? secondAvg < firstAvg - 2 : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['week', 'month'] as const).map(g => (
          <button key={g} onClick={() => { setGranularity(g); setOffset(0); }}
            style={{ padding: '4px 10px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', fontSize: 11, fontWeight: granularity === g ? 500 : 400, background: granularity === g ? '#534AB7' : t.cardInner || t.input, borderColor: granularity === g ? '#534AB7' : '#E5E7EB', color: granularity === g ? '#fff' : t.sub }}>
            {g === 'week' ? 'By Week' : 'By Month'}
          </button>
        ))}
        <div style={{ width: 1, alignSelf: 'stretch', background: t.border, margin: '0 2px' }} />
        <button onClick={() => jump('earlier')} disabled={searching !== null}
          style={{ padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${t.border}`, cursor: searching ? 'wait' : 'pointer', fontSize: 11, background: t.cardInner || t.input, color: t.sub }}>
          {searching === 'earlier' ? 'Searching…' : '← Earlier with data'}
        </button>
        <button onClick={() => jump('later')} disabled={offset === 0 || searching !== null}
          style={{ padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${t.border}`, cursor: offset === 0 || searching ? 'default' : 'pointer', fontSize: 11, background: t.cardInner || t.input, color: offset === 0 ? t.muted : t.sub, opacity: offset === 0 ? 0.5 : 1 }}>
          {searching === 'later' ? 'Searching…' : 'Later with data →'}
        </button>
        {buckets && <span style={{ fontSize: 11, color: t.muted }}>{buckets[0]?.label} – {buckets[buckets.length - 1]?.label}</span>}
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: t.muted }}>Loading attendance history…</div>
        ) : !hasData(buckets) ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: t.muted }}>{emptyText || 'No attendance records logged for this window yet.'}</div>
        ) : (
          <ResponsiveContainer width="100%" height={200} minWidth={300}>
            <AreaChart data={buckets!} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color || '#534AB7'} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color || '#534AB7'} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: t.chartAxis || t.muted }} interval={Math.floor(buckets!.length / 6)} />
              <YAxis tick={{ fontSize: 9, fill: t.chartAxis || t.muted }} domain={[0, 100]} width={32} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', background: t.chartTip, color: t.chartTipText }} />
              <Area type="monotone" dataKey="rate" name={metricLabel || 'Attendance Rate %'} stroke={color || '#534AB7'} strokeWidth={2} fill="url(#attendanceFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {hasData(buckets) && avg !== null && best && worst && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${t.border}` }}>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>What this window says</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <div style={{ fontSize: 12, color: t.sub }}><strong style={{ color: t.text }}>{avg}%</strong> average</div>
            <div style={{ fontSize: 12, color: t.sub }}><strong style={{ color: t.teal }}>{best.rate}%</strong> best — {best.label}</div>
            <div style={{ fontSize: 12, color: t.sub }}><strong style={{ color: worst.rate < 50 ? t.coral : t.text }}>{worst.rate}%</strong> weakest — {worst.label}</div>
            {trendUp && <div style={{ fontSize: 12, color: t.teal }}>↑ Trending up across this window</div>}
            {trendDown && <div style={{ fontSize: 12, color: t.coral }}>↓ Trending down — worth a closer look</div>}
          </div>
        </div>
      )}
    </div>
  );
}
