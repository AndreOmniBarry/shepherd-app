'use client';
import { useState, useEffect } from 'react';

type MonthlyRecord = {
  id: string; member_id: string; member_name: string;
  month: string; times_present: number; total_services: number;
  cell_name: string; status: string; exit_type: string;
};

const MONTHS: Record<string, string> = {
  '2026-01-01': 'January 2026', '2026-02-01': 'February 2026',
  '2026-03-01': 'March 2026', '2026-04-01': 'April 2026',
  '2026-05-01': 'May 2026', '2026-06-01': 'June 2026',
};

interface FellowshipValidationProps { t?: Record<string, string>; dark: boolean; }

export default function FellowshipValidation({ t: tProp, dark }: FellowshipValidationProps) {
  const LIGHT = { bg:'#F0EFF8',card:'#FFFFFF',text:'#1A1040',sub:'#5A5180',muted:'#9890CC',border:'rgba(83,74,183,0.12)',input:'#F7F6FF',purple:'#534AB7',purpleBg:'#EEEDFE',teal:'#1D9E75',tealBg:'#E1F5EE',coral:'#D85A30',coralBg:'#FAECE7',amber:'#BA7517',amberBg:'#FAEEDA' };
  const DARK = { bg:'#0F0A2E',card:'#1A1340',text:'#E8E5FF',sub:'#B8B0E8',muted:'#7870B0',border:'rgba(255,255,255,0.08)',input:'#1F1850',purple:'#A89FFF',purpleBg:'rgba(168,159,255,0.12)',teal:'#2DD4AA',tealBg:'rgba(45,212,170,0.12)',coral:'#F87171',coralBg:'rgba(248,113,113,0.12)',amber:'#FCD34D',amberBg:'rgba(252,211,77,0.12)' };
  const t = tProp || (dark ? DARK : LIGHT);
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/fellowship/validate-attendance', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.records) setRecords(data.records); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function validate(id: string, approve: boolean) {
    setValidating(prev => ({ ...prev, [id]: true }));
    await fetch('/api/fellowship/validate-attendance', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id, status: approve ? 'validated' : 'rejected' }),
    });
    setRecords(prev => prev.filter(r => r.id !== id));
    setValidating(prev => ({ ...prev, [id]: false }));
  }

  const pending = records.filter(r => r.status === 'pending');
  const grouped = pending.reduce((acc, r) => {
    const key = r.month;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, MonthlyRecord[]>);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading records...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Validate backdated attendance</div>
        <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
          Review and validate historical attendance records submitted by your cell leaders. Validated records appear on the pastor dashboard. Rejected records are sent back to the cell leader for correction.
        </div>
      </div>

      {pending.length === 0 ? (
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: t.teal, fontWeight: 500 }}>All records validated — no pending submissions.</div>
        </div>
      ) : (
        Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).map(([month, monthRecords]) => (
          <div key={month} style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{MONTHS[month] || month}</div>
              <div style={{ fontSize: 11, color: t.muted }}>{monthRecords.length} records pending</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                  {['Member', 'Cell', 'Present', 'Total services', 'Rate', 'Exit', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthRecords.map((r, i) => {
                  const rate = r.total_services > 0 ? Math.round((r.times_present / r.total_services) * 100) : 0;
                  return (
                    <tr key={r.id} style={{ borderBottom: i < monthRecords.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 500, color: t.text }}>{r.member_name}</td>
                      <td style={{ padding: '9px 12px', color: t.muted, fontSize: 11 }}>{r.cell_name}</td>
                      <td style={{ padding: '9px 12px', color: t.teal, fontWeight: 600 }}>{r.times_present}</td>
                      <td style={{ padding: '9px 12px', color: t.muted }}>{r.total_services}</td>
                      <td style={{ padding: '9px 12px', color: rate >= 75 ? t.teal : rate >= 50 ? t.amber : t.coral, fontWeight: 500 }}>{rate}%</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: r.exit_type !== 'none' ? t.coral : t.muted }}>
                        {r.exit_type === 'none' ? '—' : r.exit_type}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => validate(r.id, true)} disabled={validating[r.id]}
                            style={{ background: t.tealBg, color: t.teal, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                            Validate
                          </button>
                          <button onClick={() => validate(r.id, false)} disabled={validating[r.id]}
                            style={{ background: t.coralBg, color: t.coral, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
