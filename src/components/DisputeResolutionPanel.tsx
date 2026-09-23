'use client';
import { useState, useEffect } from 'react';
import { SkeletonCard, SkeletonRow } from '@/components/Skeleton';

type Dispute = {
  id: string; cell_name: string; fellowship_name: string; leader_name: string;
  service_date: string; original_present: number; original_absent: number;
  dispute_reason: string; status: string; submitted_at: string;
};

interface DisputeResolutionPanelProps { t: Record<string, string>; dark: boolean; isMobile?: boolean; }

export default function DisputeResolutionPanel({ t, dark, isMobile = false }: DisputeResolutionPanelProps) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/fellowship/disputes', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.disputes) setDisputes(data.disputes); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function resolve(id: string, approve: boolean) {
    setResolving(prev => ({ ...prev, [id]: true }));
    await fetch('/api/fellowship/disputes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id, status: approve ? 'resolved' : 'dismissed' }),
    });
    setDisputes(prev => prev.filter(d => d.id !== id));
    setResolving(prev => ({ ...prev, [id]: false }));
  }

  const pending = disputes.filter(d => d.status === 'pending');

  if (loading) return (
    <SkeletonCard>
      {Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)}
    </SkeletonCard>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Attendance disputes</div>
        <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
          Cell submissions flagged as inaccurate by fellowship heads. Resolve confirms the dispute was justified; Dismiss keeps the original submission as-is.
        </div>
      </div>

      {pending.length === 0 ? (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: t.teal, fontWeight: 500 }}>No disputes pending — nothing to review.</div>
        </div>
      ) : (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: `0.5px solid ${t.border}` }}>
            <div style={{ fontSize: 11, color: t.muted }}>{pending.length} dispute{pending.length === 1 ? '' : 's'} pending</div>
          </div>
          {isMobile ? (
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map(d => (
                <div key={d.id} style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#F7F6FF', borderRadius: 10, padding: '11px 13px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: t.text, marginBottom: 2 }}>{d.cell_name}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginBottom: 8 }}>{d.fellowship_name} · {d.service_date}</div>
                  <div style={{ fontSize: 12, color: t.sub, marginBottom: 8 }}>
                    Original: <span style={{ color: t.teal, fontWeight: 600 }}>{d.original_present}</span> present, <span style={{ color: t.coral, fontWeight: 600 }}>{d.original_absent}</span> absent
                  </div>
                  <div style={{ fontSize: 12, color: t.text, marginBottom: 10, fontStyle: 'italic' }}>"{d.dispute_reason}"</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => resolve(d.id, true)} disabled={resolving[d.id]}
                      style={{ flex: 1, background: t.tealBg, color: t.teal, border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                      Resolve
                    </button>
                    <button onClick={() => resolve(d.id, false)} disabled={resolving[d.id]}
                      style={{ flex: 1, background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                  {['Cell', 'Fellowship', 'Service date', 'Original', 'Reason', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((d, i) => (
                  <tr key={d.id} style={{ borderBottom: i < pending.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: t.text }}>{d.cell_name}</td>
                    <td style={{ padding: '9px 12px', color: t.muted, fontSize: 11 }}>{d.fellowship_name}</td>
                    <td style={{ padding: '9px 12px', color: t.muted, fontSize: 11 }}>{d.service_date}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11 }}>
                      <span style={{ color: t.teal, fontWeight: 600 }}>{d.original_present}</span> / <span style={{ color: t.coral, fontWeight: 600 }}>{d.original_absent}</span>
                    </td>
                    <td style={{ padding: '9px 12px', color: t.sub, fontStyle: 'italic', maxWidth: 240 }}>"{d.dispute_reason}"</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => resolve(d.id, true)} disabled={resolving[d.id]}
                          style={{ background: t.tealBg, color: t.teal, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                          Resolve
                        </button>
                        <button onClick={() => resolve(d.id, false)} disabled={resolving[d.id]}
                          style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
