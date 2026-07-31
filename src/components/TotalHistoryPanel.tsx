'use client';
import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Bucket = { label: string; total: number };

const MAX_LOOKBACK = 8;

function hasData(buckets: Bucket[] | null): boolean {
  return !!buckets && buckets.some(b => b.total > 0);
}

// Same paginated week/month/year history model as AttendanceHistoryPanel —
// area chart, Previous/Next skip-to-data, mini-analysis strip — but for a
// running total (member count, currency, etc.) instead of a present/absent
// rate, so the Y-axis auto-scales instead of being fixed to 0-100.
export default function TotalHistoryPanel({ t, fetchUrl, color, valueLabel, formatValue, emptyText, defaultGranularity }: { t: Record<string, string>; fetchUrl: (granularity: 'week' | 'month' | 'year', offset: number) => string; color?: string; valueLabel?: string; formatValue?: (n: number) => string; emptyText?: string; defaultGranularity?: 'week' | 'month' | 'year' }) {
  const [granularity, setGranularity] = useState<'week' | 'month' | 'year'>(defaultGranularity || 'week');
  const [offset, setOffset] = useState(0);
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState<'earlier' | 'later' | null>(null);
  const [noEarlier, setNoEarlier] = useState(false);
  const [noLater, setNoLater] = useState(false);

  const fmt = formatValue || ((n: number) => String(n));

  const fetchBuckets = useCallback((g: 'week' | 'month' | 'year', o: number) => {
    return fetch(fetchUrl(g, o), { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => (data?.buckets as Bucket[] | undefined) || null)
      .catch(() => null);
  }, [fetchUrl]);

  useEffect(() => {
    setLoading(true);
    fetchBuckets(granularity, offset).then(b => { setBuckets(b); setLoading(false); });
  }, [granularity, offset, fetchBuckets]);

  // Never lands somewhere nonsensical (e.g. decades/centuries back) if
  // there's simply no earlier data — reverts to where it was and disables
  // that direction until new data appears, same as AttendanceHistoryPanel.
  async function jump(direction: 'earlier' | 'later') {
    setSearching(direction);
    let o = offset;
    let found: { offset: number; buckets: Bucket[] } | null = null;
    for (let i = 0; i < MAX_LOOKBACK; i++) {
      o = direction === 'earlier' ? o + 1 : o - 1;
      if (o < 0) { o = 0; break; }
      const b = await fetchBuckets(granularity, o);
      if (hasData(b)) { found = { offset: o, buckets: b! }; break; }
      if (direction === 'later' && o === 0) break;
    }
    if (found) {
      setOffset(found.offset); setBuckets(found.buckets);
      setNoEarlier(false); setNoLater(false);
    } else if (direction === 'earlier') {
      setNoEarlier(true);
    } else {
      setNoLater(true);
    }
    setSearching(null);
  }

  const avg = buckets && buckets.length > 0 ? Math.round(buckets.reduce((s, b) => s + b.total, 0) / buckets.length) : null;
  const best = buckets && buckets.length > 0 ? buckets.reduce((a, b) => b.total > a.total ? b : a) : null;
  const worst = buckets && buckets.length > 0 ? buckets.reduce((a, b) => b.total < a.total ? b : a) : null;
  const firstHalf = buckets ? buckets.slice(0, Math.ceil(buckets.length / 2)) : [];
  const secondHalf = buckets ? buckets.slice(Math.ceil(buckets.length / 2)) : [];
  const firstAvg = firstHalf.length ? firstHalf.reduce((s, b) => s + b.total, 0) / firstHalf.length : 0;
  const secondAvg = secondHalf.length ? secondHalf.reduce((s, b) => s + b.total, 0) / secondHalf.length : 0;
  const trendUp = buckets && buckets.length >= 4 ? secondAvg > firstAvg * 1.02 : null;
  const trendDown = buckets && buckets.length >= 4 ? secondAvg < firstAvg * 0.98 : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['week', 'month', 'year'] as const).map(g => (
          <button key={g} onClick={() => { setGranularity(g); setOffset(0); setNoEarlier(false); setNoLater(false); }}
            style={{ padding: '4px 10px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', fontSize: 11, fontWeight: granularity === g ? 500 : 400, background: granularity === g ? '#534AB7' : t.cardInner || t.input, borderColor: granularity === g ? '#534AB7' : '#E5E7EB', color: granularity === g ? '#fff' : t.sub }}>
            {g === 'week' ? 'By Week' : g === 'month' ? 'By Month' : 'By Year'}
          </button>
        ))}
        <div style={{ width: 1, alignSelf: 'stretch', background: t.border, margin: '0 2px' }} />
        <button onClick={() => jump('earlier')} disabled={searching !== null || noEarlier} title={noEarlier ? 'No earlier records found' : 'Jump back to the previous window with activity logged'}
          style={{ padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${t.border}`, cursor: searching ? 'wait' : noEarlier ? 'default' : 'pointer', fontSize: 11, background: t.cardInner || t.input, color: noEarlier ? t.muted : t.sub, opacity: noEarlier ? 0.5 : 1 }}>
          {searching === 'earlier' ? 'Searching…' : '← Previous'}
        </button>
        <button onClick={() => jump('later')} disabled={offset === 0 || searching !== null || noLater} title={noLater ? 'No later records found' : 'Jump forward to the next window with activity logged'}
          style={{ padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${t.border}`, cursor: offset === 0 || searching || noLater ? 'default' : 'pointer', fontSize: 11, background: t.cardInner || t.input, color: offset === 0 || noLater ? t.muted : t.sub, opacity: offset === 0 || noLater ? 0.5 : 1 }}>
          {searching === 'later' ? 'Searching…' : 'Next →'}
        </button>
        {buckets && <span style={{ fontSize: 11, color: t.muted }}>{buckets.length} {granularity}s · {buckets[0]?.label} – {buckets[buckets.length - 1]?.label}</span>}
        {(noEarlier || noLater) && <span style={{ fontSize: 11, color: t.muted, fontStyle: 'italic' }}>{noEarlier ? 'No earlier records found' : 'No later records found'}</span>}
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: t.muted }}>Loading history…</div>
        ) : !hasData(buckets) ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: t.muted }}>{emptyText || 'No records for this window yet.'}</div>
        ) : (
          <ResponsiveContainer width="100%" height={200} minWidth={300}>
            <AreaChart data={buckets!} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color || '#534AB7'} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color || '#534AB7'} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: t.chartAxis || t.muted }} interval={Math.floor(buckets!.length / 6)} />
              <YAxis tick={{ fontSize: 9, fill: t.chartAxis || t.muted }} width={40} tickFormatter={fmt} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', background: t.chartTip, color: t.chartTipText }} formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="total" name={valueLabel || 'Total'} stroke={color || '#534AB7'} strokeWidth={2} fill="url(#totalFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {hasData(buckets) && avg !== null && best && worst && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${t.border}` }}>
          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <div style={{ fontSize: 12, color: t.sub }}><strong style={{ color: t.text }}>{fmt(avg)}</strong> average</div>
            <div style={{ fontSize: 12, color: t.sub }}><strong style={{ color: t.teal }}>{fmt(best.total)}</strong> highest — {best.label}</div>
            <div style={{ fontSize: 12, color: t.sub }}><strong style={{ color: t.text }}>{fmt(worst.total)}</strong> lowest — {worst.label}</div>
            {trendUp && <div style={{ fontSize: 12, color: t.teal }}>↑ Trending up across this window</div>}
            {trendDown && <div style={{ fontSize: 12, color: t.coral }}>↓ Trending down — worth a closer look</div>}
          </div>
        </div>
      )}
    </div>
  );
}
