'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Bucket = { label: string; present: number; absent: number; rate: number };

// Real, paginated attendance history — no preset "8w/3m/6m/1y" range list.
// Toggle between week/month buckets and page further back in time instead.
// Reused by the cell portal, fellowship portal, and admin dashboard so every
// history view in the app behaves the same way.
export default function AttendanceHistoryPanel({ t, fetchUrl, color }: { t: Record<string, string>; fetchUrl: (granularity: 'week' | 'month', offset: number) => string; color?: string }) {
  const [granularity, setGranularity] = useState<'week' | 'month'>('week');
  const [offset, setOffset] = useState(0);
  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(fetchUrl(granularity, offset), { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => setBuckets(data?.buckets || null))
      .catch(() => setBuckets(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, offset]);

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
        <button onClick={() => setOffset(o => o + 1)} style={{ padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${t.border}`, cursor: 'pointer', fontSize: 11, background: t.cardInner || t.input, color: t.sub }}>← Earlier</button>
        <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} style={{ padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${t.border}`, cursor: offset === 0 ? 'default' : 'pointer', fontSize: 11, background: t.cardInner || t.input, color: offset === 0 ? t.muted : t.sub, opacity: offset === 0 ? 0.5 : 1 }}>Later →</button>
        {buckets && <span style={{ fontSize: 11, color: t.muted }}>{buckets[0]?.label} – {buckets[buckets.length - 1]?.label}</span>}
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: t.muted }}>Loading attendance history…</div>
        ) : !buckets || buckets.every(b => b.present === 0 && b.absent === 0) ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12, color: t.muted }}>No attendance records logged for this window yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200} minWidth={300}>
            <LineChart data={buckets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: t.chartAxis || t.muted }} interval={Math.floor(buckets.length / 6)} />
              <YAxis tick={{ fontSize: 9, fill: t.chartAxis || t.muted }} domain={[0, 100]} width={32} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', background: t.chartTip, color: t.chartTipText }} />
              <Line type="monotone" dataKey="rate" name="Attendance Rate %" stroke={color || '#534AB7'} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
