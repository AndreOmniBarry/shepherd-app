'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/currency';

type Partner = { id: string; status: string; this_month_paid: boolean; band_amount: number; total_given: number };

interface PartnershipSummaryPanelProps { t: Record<string, string>; isMobile?: boolean; currency?: string; }

// Partnership (recurring covenant partners, tracked separately from
// Sunday tithe/offering/special/project giving) had no visibility at all
// on the pastor's Dashboard — not merged into Giving's numbers here,
// deliberately kept in its own container so it reads as a distinct
// program rather than blended into weekly-service giving totals.
export default function PartnershipSummaryPanel({ t, isMobile = false, currency }: PartnershipSummaryPanelProps) {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[] | null>(null);

  useEffect(() => {
    fetch('/api/partnership/partners', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => setPartners(data?.partners || []))
      .catch(() => setPartners([]));
  }, []);

  if (partners === null) return null;
  if (partners.length === 0) return null;

  const active = partners.filter(p => p.status === 'active');
  const paidThisMonth = active.filter(p => p.this_month_paid).length;
  const totalMonthlyPledge = active.reduce((a, p) => a + p.band_amount, 0);
  const totalCollected = partners.reduce((a, p) => a + p.total_given, 0);
  const collectionRate = active.length > 0 ? Math.round((paidThisMonth / active.length) * 100) : 0;

  return (
    <div style={{ background: t.purpleBg, border: '0.5px solid rgba(83,74,183,0.25)', borderRadius: 12, padding: '16px 18px', marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.purple }}>Partnership Program</div>
          <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>Recurring covenant partners — tracked separately from Sunday giving.</div>
        </div>
        <button onClick={() => router.push('/partnership')}
          style={{ background: 'transparent', border: `0.5px solid ${t.purple}`, color: t.purple, borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          View portal →
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Active partners', value: String(active.length) },
          { label: 'Paid this month', value: `${paidThisMonth}/${active.length} (${collectionRate}%)` },
          { label: 'Monthly pledge total', value: formatMoney(totalMonthlyPledge, currency) },
          { label: 'Total collected', value: formatMoney(totalCollected, currency) },
        ].map(s => (
          <div key={s.label} style={{ background: t.card, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${t.border}` }}>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: t.text }}>{s.value}</div>
            <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
