'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const C = {
  purple: '#534AB7', purpleDark: '#3C3489', purpleBg: '#EEEDFE',
  teal: '#1D9E75', tealBg: '#E1F5EE',
  coral: '#D85A30', coralBg: '#FAECE7',
  amber: '#BA7517', amberBg: '#FAEEDA',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', white: '#FFFFFF', bg: '#F4F3FB',
  card: '#FFFFFF',
};

type SystemAlert = {
  id: string;
  church_id: string | null;
  church_name: string | null;
  severity: 'critical' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
};

type PlatformAllocation = { id: string; name: string; footprint_share: number; allocated_ngn: number | null };

type ChurchFootprintView = {
  members: number;
  attendance_records: number;
  chat_messages_total: number;
  chat_messages_this_month: number;
  feed_posts: number;
  feed_comments: number;
  feed_reactions: number;
  storage_bytes: number;
  share: number;
};

type ChurchUsage = {
  church_id: string;
  church_name: string;
  plan_tier: string;
  subscription_status: string;
  this_week_ngn: number;
  last_week_ngn: number;
  this_month_ngn: number;
  this_month_by_type: Record<string, number>;
  overage_events_this_month: number;
  projected_month_end_ngn: number;
  cost_breakdown: {
    exact_ngn: number;
    estimated_ngn: number;
    claude_ngn: number;
    paystack_fee_ngn: number;
    sms_whatsapp_ngn: number;
    platform_allocations: PlatformAllocation[];
  };
  footprint: ChurchFootprintView | null;
  revenue_ngn: number | null; // null = Enterprise custom pricing
  margin_ngn: number | null;
};

type PlatformCostLineItem = {
  id: string;
  name: string;
  monthly_bill_ngn: number | null;
  footprint_measure: string;
  allocations: { church_id: string; church_name: string; footprint_share: number; allocated_ngn: number | null }[];
};

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ── Small chart primitives for the Analytics tab ─────────────
// Deliberately plain CSS bars, matching the rest of this hand-rolled
// inline-style codebase rather than pulling in a charting library for a
// handful of magnitude/trend views. Single hue per chart (the category
// name is already the label, so color isn't carrying identity) — never a
// rainbow-per-bar.
function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// Ranked horizontal bars — magnitude by named category, one hue.
function BreakdownBars({ data, color, bg, formatLabel }: { data: Record<string, number>; color: string; bg: string; formatLabel?: (k: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(e => e[1]));
  if (entries.length === 0) return <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>No data yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {entries.map(([key, count]) => (
        <div key={key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
            <span style={{ color: C.text, fontWeight: 500, textTransform: 'capitalize' }}>{formatLabel ? formatLabel(key) : key.replace(/_/g, ' ')}</span>
            <span style={{ color: C.muted }}>{count}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: bg, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(count / max) * 100}%`, borderRadius: 4, background: color, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Vertical column trend — evenly spaced buckets (month or day), one hue,
// rounded top edge, baseline-anchored. Hover shows the exact count so a
// bar that rounds visually to zero-height is still legible.
function TrendColumns({ data, color, labelKey, valueKey, formatLabel }: { data: Record<string, unknown>[]; color: string; labelKey: string; valueKey: string; formatLabel?: (k: string) => string }) {
  const max = Math.max(1, ...data.map(d => Number(d[valueKey]) || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const label = String(d[labelKey]);
        return (
          <div key={i} title={`${formatLabel ? formatLabel(label) : label}: ${val}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}>
            <div style={{ width: '100%', maxWidth: 22, height: `${Math.max(2, (val / max) * 100)}%`, background: color, borderRadius: '4px 4px 1px 1px', transition: 'height 0.3s ease' }} />
          </div>
        );
      })}
    </div>
  );
}

type Church = {
  id: string;
  church_name: string;
  country: string;
  structure_type: string;
  tier1_label: string;
  tier2_label: string;
  plan_tier: string;
  subscription_status: string;
  trial_days_remaining: number;
  is_configured: boolean;
  church_profile: Record<string, unknown>;
  created_at: string;
};

type AnalyticsData = {
  totalChurches: number; totalUsers: number; activeUsers: number;
  byPlan: Record<string, number>; byStatus: Record<string, number>;
  byStructure: Record<string, number>; byCountry: Record<string, number>; byRole: Record<string, number>;
  churchSignupTrend: { month: string; count: number }[];
  userSignupTrend: { month: string; count: number }[];
  usageTrend: { day: string; total: number }[];
  usageByType: Record<string, number>;
  mostEngagedChurches: { church_id: string; church_name: string; event_count: number }[];
};

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  trial: { bg: C.amberBg, color: C.amber },
  starter: { bg: C.tealBg, color: C.teal },
  growth: { bg: C.purpleBg, color: C.purple },
  enterprise: { bg: '#FDF3E7', color: '#B45309' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  trial: { bg: C.amberBg, color: C.amber },
  active: { bg: C.tealBg, color: C.teal },
  expired: { bg: C.coralBg, color: C.coral },
  cancelled: { bg: '#F3F4F6', color: '#6B7280' },
};

export default function AdminPortal() {
  const router = useRouter();
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Church | null>(null);
  const [tab, setTab] = useState<'overview' | 'profile' | 'goals' | 'notes'>('overview');
  const [sidebarTab, setSidebarTab] = useState<'churches' | 'billing' | 'usage' | 'analytics' | 'alerts' | 'settings'>('churches');
  const [usage, setUsage] = useState<ChurchUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageSort, setUsageSort] = useState<'this_month_ngn' | 'this_week_ngn' | 'projected_month_end_ngn' | 'margin_ngn'>('this_month_ngn');
  const [expandedChurchId, setExpandedChurchId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<PlatformCostLineItem[]>([]);
  const [lineItemsLoading, setLineItemsLoading] = useState(true);
  const [newLineItemName, setNewLineItemName] = useState('');
  const [billDrafts, setBillDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [stats, setStats] = useState({ total: 0, trial: 0, active: 0, expired: 0, growth: 0, starter: 0 });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [sysAlerts, setSysAlerts] = useState<SystemAlert[]>([]);
  const [alertCounts, setAlertCounts] = useState({ critical: 0, medium: 0, low: 0 });
  const [alertsLoading, setAlertsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/churches', { credentials: 'include' })
      .then(r => {
        if (r.status === 403) { router.push('/dashboard'); return null; }
        return r.json();
      })
      .then(d => {
        if (d?.data?.churches) {
          const c = d.data.churches;
          setChurches(c);
          setStats({
            total: c.length,
            trial: c.filter((x: Church) => x.subscription_status === 'trial').length,
            active: c.filter((x: Church) => x.subscription_status === 'active').length,
            expired: c.filter((x: Church) => x.subscription_status === 'expired').length,
            growth: c.filter((x: Church) => x.plan_tier === 'growth').length,
            starter: c.filter((x: Church) => x.plan_tier === 'starter').length,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/admin/alerts', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d?.data) {
          setSysAlerts(d.data.alerts || []);
          setAlertCounts(d.data.counts || { critical: 0, medium: 0, low: 0 });
        }
      })
      .catch(() => {})
      .finally(() => setAlertsLoading(false));

    fetch('/api/admin/usage', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d?.data?.churches) setUsage(d.data.churches); })
      .catch(() => {})
      .finally(() => setUsageLoading(false));

    loadLineItems();

    fetch('/api/admin/analytics', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d?.data) setAnalytics(d.data); })
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, []);

  function loadLineItems() {
    setLineItemsLoading(true);
    fetch('/api/admin/platform-costs', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d?.data?.line_items) setLineItems(d.data.line_items); })
      .catch(() => {})
      .finally(() => setLineItemsLoading(false));
  }

  async function addLineItem() {
    const name = newLineItemName.trim();
    if (!name) return;
    setNewLineItemName('');
    await fetch('/api/admin/platform-costs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ name }),
    }).catch(() => {});
    loadLineItems();
  }

  async function saveLineItemBill(id: string) {
    const raw = billDrafts[id];
    const monthly_bill_ngn = raw === undefined || raw.trim() === '' ? null : Number(raw);
    if (monthly_bill_ngn !== null && !Number.isFinite(monthly_bill_ngn)) return;
    await fetch('/api/admin/platform-costs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id, monthly_bill_ngn }),
    }).catch(() => {});
    loadLineItems();
    fetch('/api/admin/usage', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d?.data?.churches) setUsage(d.data.churches); })
      .catch(() => {});
  }

  async function deleteLineItem(id: string) {
    await fetch('/api/admin/platform-costs', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id }),
    }).catch(() => {});
    loadLineItems();
  }

  async function updateAlertStatus(id: string, status: 'acknowledged' | 'resolved') {
    setSysAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await fetch('/api/admin/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
  }

  function selectChurch(c: Church) {
    setSelected(c);
    setNotes((c.church_profile as Record<string, string>)?.admin_notes || '');
    setTab('overview');
  }

  async function saveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    await fetch(`/api/admin/churches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: selected.id, admin_notes: notes }),
    });
    setSavingNotes(false);
  }

  const card = (e?: React.CSSProperties): React.CSSProperties => ({ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, ...e });

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 14, color: C.muted }}>Loading admin portal…</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-inter, Inter, sans-serif)', display: 'flex' }}>

      {/* Sidebar */}
      <div style={{ width: 220, background: C.purpleDark, minHeight: '100vh', padding: '24px 0', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '0 18px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.white, letterSpacing: '-0.2px' }}>SHEP.HERD</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Lead Tech Admin</div>
        </div>
        <div style={{ padding: '16px 10px', flex: 1 }}>
          {([{ id: 'churches' as const, label: 'Churches' }, { id: 'billing' as const, label: 'Plans & Billing' }, { id: 'usage' as const, label: 'Usage & Spend' }, { id: 'analytics' as const, label: 'Analytics' }, { id: 'alerts' as const, label: 'Health & Alerts' }, { id: 'settings' as const, label: 'Settings' }]).map((item) => (
            <div key={item.id} onClick={() => setSidebarTab(item.id)}
              style={{ padding: '9px 10px', borderRadius: 7, marginBottom: 2, background: sidebarTab === item.id ? 'rgba(255,255,255,0.1)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, fontWeight: sidebarTab === item.id ? 600 : 400, color: sidebarTab === item.id ? C.white : 'rgba(255,255,255,0.45)' }}>{item.label}</div>
              {item.id === 'alerts' && alertCounts.critical > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: C.white, background: C.coral, borderRadius: 10, padding: '1px 7px' }}>{alertCounts.critical}</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 18px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            ← Back to dashboard
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            {sidebarTab === 'churches' ? 'Church Management' : sidebarTab === 'billing' ? 'Plans & Billing' : sidebarTab === 'usage' ? 'Usage & Spend' : sidebarTab === 'analytics' ? 'Analytics' : sidebarTab === 'alerts' ? 'Health & Alerts' : 'Settings'}
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {sidebarTab === 'churches' ? 'All onboarded churches, their structures, plans, and trial status'
              : sidebarTab === 'billing' ? 'Plan tier and subscription status per church'
              : sidebarTab === 'usage' ? 'Live Moshe AI and SMS/WhatsApp spend rate, per church — who\'s burning fastest and who\'s already past their included quota'
              : sidebarTab === 'analytics' ? 'Platform growth and adoption — signups, structure/plan mix, and usage volume trend'
              : sidebarTab === 'alerts' ? 'Technical triage, checked automatically — critical issues first'
              : 'Platform-level configuration'}
          </div>
        </div>

        {sidebarTab === 'billing' && (
          <div style={{ ...card({ padding: 0, overflow: 'hidden' }) }}>
            <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.text }}>All churches — plan &amp; status</div>
            {churches.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No churches onboarded yet.</div>
            ) : churches.map((church, i) => {
              const planC = PLAN_COLORS[church.plan_tier] || PLAN_COLORS.trial;
              const statusC = STATUS_COLORS[church.subscription_status] || STATUS_COLORS.trial;
              return (
                <div key={church.id} style={{ padding: '14px 18px', borderBottom: i < churches.length - 1 ? `0.5px solid ${C.border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{church.church_name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: planC.bg, color: planC.color }}>{(church.plan_tier || 'trial').toUpperCase()}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: statusC.bg, color: statusC.color }}>{(church.subscription_status || 'trial').toUpperCase()}{church.subscription_status === 'trial' ? ` · ${church.trial_days_remaining}d left` : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sidebarTab === 'usage' && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Exact cost this month (Claude + Paystack)', value: usage.reduce((s, c) => s + (c.cost_breakdown?.exact_ngn || 0), 0), color: C.teal },
              { label: 'Estimated cost this month (SMS/WhatsApp + allocated bills)', value: usage.reduce((s, c) => s + (c.cost_breakdown?.estimated_ngn || 0), 0), color: C.amber },
              { label: 'Total revenue this month (known plans)', value: usage.reduce((s, c) => s + (c.revenue_ngn || 0), 0), color: C.purple },
              { label: 'Churches over their quota this month', value: usage.filter(c => c.overage_events_this_month > 0).length, color: C.coral, isCount: true },
            ].map((s, i) => (
              <div key={i} style={{ ...card({ padding: '14px 16px' }) }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.isCount ? s.value : `₦${Math.round(s.value).toLocaleString()}`}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card({ padding: 0, overflow: 'hidden' }), marginBottom: 20 }}>
            <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Every church — cost vs. revenue, exact vs. estimated</div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>Exact = real Claude token cost + real Paystack fees. Estimated = SMS/WhatsApp placeholders + allocated share of platform bills below. Click a row for the full breakdown.</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([{ id: 'this_week_ngn' as const, label: 'This week' }, { id: 'this_month_ngn' as const, label: 'This month' }, { id: 'projected_month_end_ngn' as const, label: 'Projected' }, { id: 'margin_ngn' as const, label: 'Margin' }]).map(s => (
                  <button key={s.id} onClick={() => setUsageSort(s.id)}
                    style={{ fontSize: 10.5, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: usageSort === s.id ? C.purple : C.purpleBg, color: usageSort === s.id ? C.white : C.purple }}>
                    Sort: {s.label}
                  </button>
                ))}
              </div>
            </div>
            {usageLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>
            ) : usage.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No usage logged yet — nothing has hit Moshe or sent an SMS.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '9px 18px', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: `0.5px solid ${C.border}` }}>
                  <div>Church</div><div>Plan</div><div>Exact cost</div><div>Est. cost</div><div>Revenue</div><div>Margin</div><div>Overage</div>
                </div>
                {[...usage].sort((a, b) => (b[usageSort] ?? -Infinity) - (a[usageSort] ?? -Infinity)).map((c, i, arr) => {
                  const planC = PLAN_COLORS[c.plan_tier] || PLAN_COLORS.trial;
                  const isExpanded = expandedChurchId === c.church_id;
                  const cb = c.cost_breakdown;
                  const fp = c.footprint;
                  return (
                    <div key={c.church_id} style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${C.border}` : 'none' }}>
                      <div onClick={() => setExpandedChurchId(isExpanded ? null : c.church_id)}
                        style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr', gap: 8, padding: '12px 18px', alignItems: 'center', cursor: 'pointer', background: isExpanded ? C.purpleBg : 'transparent' }}>
                        <div style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{c.church_name}</div>
                        <div><span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 10, fontWeight: 600, background: planC.bg, color: planC.color }}>{(c.plan_tier || 'trial').toUpperCase()}</span></div>
                        <div style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>₦{Math.round(cb?.exact_ngn || 0).toLocaleString()}</div>
                        <div style={{ fontSize: 12, color: C.amber, fontWeight: 600 }}>₦{Math.round(cb?.estimated_ngn || 0).toLocaleString()}</div>
                        <div style={{ fontSize: 12, color: C.text }}>{c.revenue_ngn === null ? 'Custom' : `₦${Math.round(c.revenue_ngn).toLocaleString()}`}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.margin_ngn === null ? C.muted : c.margin_ngn < 0 ? C.coral : C.teal }}>
                          {c.margin_ngn === null ? '—' : `₦${Math.round(c.margin_ngn).toLocaleString()}`}
                        </div>
                        <div>{c.overage_events_this_month > 0 ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.coral, background: C.coralBg, borderRadius: 10, padding: '2px 8px' }}>{c.overage_events_this_month} over</span>
                        ) : <span style={{ fontSize: 11, color: C.muted }}>—</span>}</div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '14px 18px 18px', background: C.purpleBg, borderTop: `0.5px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Cost — this month</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: C.muted }}>Claude tokens <em style={{ color: C.teal, fontStyle: 'normal' }}>(exact)</em></span><span style={{ color: C.text }}>₦{Math.round(cb?.claude_ngn || 0).toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: C.muted }}>Paystack fees <em style={{ color: C.teal, fontStyle: 'normal' }}>(exact)</em></span><span style={{ color: C.text }}>₦{Math.round(cb?.paystack_fee_ngn || 0).toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span style={{ color: C.muted }}>SMS/WhatsApp <em style={{ color: C.amber, fontStyle: 'normal' }}>(placeholder estimate)</em></span><span style={{ color: C.text }}>₦{Math.round(cb?.sms_whatsapp_ngn || 0).toLocaleString()}</span></div>
                              {(cb?.platform_allocations || []).map(a => (
                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                                  <span style={{ color: C.muted }}>{a.name} allocation <em style={{ color: C.amber, fontStyle: 'normal' }}>({(a.footprint_share * 100).toFixed(1)}% footprint, estimate)</em></span>
                                  <span style={{ color: C.text }}>{a.allocated_ngn === null ? 'bill not set' : `₦${Math.round(a.allocated_ngn).toLocaleString()}`}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Footprint — exact counts</div>
                            {fp ? (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', fontSize: 11.5 }}>
                                <div style={{ color: C.muted }}>Members</div><div style={{ color: C.text, textAlign: 'right' }}>{fp.members.toLocaleString()}</div>
                                <div style={{ color: C.muted }}>Attendance records</div><div style={{ color: C.text, textAlign: 'right' }}>{fp.attendance_records.toLocaleString()}</div>
                                <div style={{ color: C.muted }}>Chat messages (all-time)</div><div style={{ color: C.text, textAlign: 'right' }}>{fp.chat_messages_total.toLocaleString()}</div>
                                <div style={{ color: C.muted }}>Chat messages (this month)</div><div style={{ color: C.text, textAlign: 'right' }}>{fp.chat_messages_this_month.toLocaleString()}</div>
                                <div style={{ color: C.muted }}>Feed posts</div><div style={{ color: C.text, textAlign: 'right' }}>{fp.feed_posts.toLocaleString()}</div>
                                <div style={{ color: C.muted }}>Feed comments</div><div style={{ color: C.text, textAlign: 'right' }}>{fp.feed_comments.toLocaleString()}</div>
                                <div style={{ color: C.muted }}>Feed reactions</div><div style={{ color: C.text, textAlign: 'right' }}>{fp.feed_reactions.toLocaleString()}</div>
                                <div style={{ color: C.muted }}>Storage uploaded</div><div style={{ color: C.text, textAlign: 'right' }}>{fmtBytes(fp.storage_bytes)}</div>
                                <div style={{ color: C.muted, fontWeight: 600 }}>Footprint share</div><div style={{ color: C.purple, textAlign: 'right', fontWeight: 700 }}>{(fp.share * 100).toFixed(1)}%</div>
                              </div>
                            ) : <div style={{ fontSize: 11.5, color: C.muted }}>No footprint data yet.</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div style={{ ...card({ padding: 0, overflow: 'hidden' }) }}>
            <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Platform cost line items</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                Recurring bills with no per-request metering (Supabase, Vercel, …). Each is allocated across churches by their footprint share above — always labeled as an allocated ESTIMATE, never an exact metered cost (Supabase bills one shared project, it doesn&apos;t itemize per church).
              </div>
            </div>
            {lineItemsLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>
            ) : (
              <>
                {lineItems.map((li, i) => (
                  <div key={li.id} style={{ padding: '12px 18px', borderBottom: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, fontSize: 12.5, color: C.text, fontWeight: 500 }}>{li.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {li.monthly_bill_ngn === null ? 'Bill not set — allocated ₦ shown as "not set" until entered' : `Total allocated this month: ₦${Math.round(li.allocations.reduce((s, a) => s + (a.allocated_ngn || 0), 0)).toLocaleString()}`}
                    </div>
                    <span style={{ fontSize: 12, color: C.muted }}>₦</span>
                    <input
                      type="number"
                      placeholder="not set"
                      defaultValue={li.monthly_bill_ngn ?? ''}
                      onChange={e => setBillDrafts(prev => ({ ...prev, [li.id]: e.target.value }))}
                      style={{ width: 120, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 12, color: C.text, outline: 'none' }}
                    />
                    <button onClick={() => saveLineItemBill(li.id)}
                      style={{ fontSize: 11, fontWeight: 600, color: C.white, background: C.purple, border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>
                      Save
                    </button>
                    <button onClick={() => deleteLineItem(li.id)}
                      style={{ fontSize: 11, fontWeight: 600, color: C.coral, background: 'none', border: 'none', cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                ))}
                <div style={{ padding: '12px 18px', display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="New line item name (e.g. Vercel)"
                    value={newLineItemName}
                    onChange={e => setNewLineItemName(e.target.value)}
                    style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, color: C.text, outline: 'none' }}
                  />
                  <button onClick={addLineItem}
                    style={{ fontSize: 11.5, fontWeight: 600, color: C.purple, background: C.purpleBg, border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}>
                    + Add line item
                  </button>
                </div>
              </>
            )}
          </div>
        </>)}

        {sidebarTab === 'analytics' && (<>
          {analyticsLoading ? (
            <div style={{ fontSize: 13, color: C.muted, padding: '40px 0', textAlign: 'center' }}>Loading analytics…</div>
          ) : !analytics ? (
            <div style={{ fontSize: 13, color: C.muted, padding: '40px 0', textAlign: 'center' }}>Could not load analytics.</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
                <StatTile label="Total churches" value={analytics.totalChurches} />
                <StatTile label="Total users" value={analytics.totalUsers} sub={`${analytics.activeUsers} active`} />
                <StatTile label="Active rate" value={analytics.totalUsers > 0 ? `${Math.round((analytics.activeUsers / analytics.totalUsers) * 100)}%` : '—'} />
                <StatTile label="Usage events (30d)" value={Object.values(analytics.usageByType).reduce((a, b) => a + b, 0)} sub="Moshe · SMS · WhatsApp · storage" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div style={card({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>Church signups</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Last 6 months</div>
                  <TrendColumns data={analytics.churchSignupTrend} color={C.purple} labelKey="month" valueKey="count" />
                </div>
                <div style={card({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>User signups</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Last 6 months, across all churches</div>
                  <TrendColumns data={analytics.userSignupTrend} color={C.teal} labelKey="month" valueKey="count" />
                </div>
              </div>

              <div style={{ ...card({ padding: 18 }), marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>Usage volume</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>usage_events per day, last 30 days — activity volume, not cost (see Usage &amp; Spend for ₦)</div>
                <TrendColumns data={analytics.usageTrend} color={C.amber} labelKey="day" valueKey="total" formatLabel={d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div style={card({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Plan tier mix</div>
                  <BreakdownBars data={analytics.byPlan} color={C.purple} bg={C.purpleBg} />
                </div>
                <div style={card({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Subscription status</div>
                  <BreakdownBars data={analytics.byStatus} color={C.teal} bg={C.tealBg} />
                </div>
                <div style={card({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Structure type</div>
                  <BreakdownBars data={analytics.byStructure} color={C.amber} bg={C.amberBg} formatLabel={k => k.replace(/_/g, ' ')} />
                </div>
                <div style={card({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Top countries</div>
                  <BreakdownBars data={analytics.byCountry} color={C.coral} bg={C.coralBg} />
                </div>
                <div style={card({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Users by role</div>
                  <BreakdownBars data={analytics.byRole} color={C.purple} bg={C.purpleBg} formatLabel={k => k.replace(/_/g, ' ')} />
                </div>
                <div style={card({ padding: 18 })}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>Most engaged churches</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>By usage_events volume, last 30 days</div>
                  {analytics.mostEngagedChurches.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.muted }}>No activity yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {analytics.mostEngagedChurches.map((c, i) => (
                        <div key={c.church_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span style={{ color: C.text }}><span style={{ color: C.muted, marginRight: 6 }}>{i + 1}.</span>{c.church_name}</span>
                          <span style={{ color: C.muted, fontWeight: 600 }}>{c.event_count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>)}

        {sidebarTab === 'alerts' && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Critical', value: alertCounts.critical, color: C.coral, bg: C.coralBg },
              { label: 'Medium', value: alertCounts.medium, color: C.amber, bg: C.amberBg },
              { label: 'Low', value: alertCounts.low, color: C.muted, bg: '#F3F2FA' },
            ].map(s => (
              <div key={s.label} style={{ ...card({ padding: '14px 16px' }) }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.value > 0 ? s.color : C.text }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card({ padding: 0, overflow: 'hidden' }) }}>
            <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.text }}>
              Open alerts, checked automatically once a day
            </div>
            {alertsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>
            ) : sysAlerts.filter(a => a.status !== 'resolved').length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Nothing needs attention right now.</div>
            ) : sysAlerts.filter(a => a.status !== 'resolved').map((a, i, arr) => {
              const sevC = a.severity === 'critical' ? { c: C.coral, bg: C.coralBg } : a.severity === 'medium' ? { c: C.amber, bg: C.amberBg } : { c: C.muted, bg: '#F3F2FA' };
              return (
                <div key={a.id} style={{ padding: '14px 18px', borderBottom: i < arr.length - 1 ? `0.5px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: sevC.bg, color: sevC.c, flexShrink: 0, textTransform: 'uppercase' }}>{a.severity}</span>
                      <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{a.title}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {a.status === 'open' && (
                        <button onClick={() => updateAlertStatus(a.id, 'acknowledged')} style={{ fontSize: 11, fontWeight: 600, color: C.purple, background: C.purpleBg, border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>Acknowledge</button>
                      )}
                      <button onClick={() => updateAlertStatus(a.id, 'resolved')} style={{ fontSize: 11, fontWeight: 600, color: C.teal, background: C.tealBg, border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>Resolve</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>{a.detail}</div>
                  {a.status === 'acknowledged' && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Acknowledged</div>}
                </div>
              );
            })}
          </div>
        </>)}

        {sidebarTab === 'settings' && (
          <div style={{ ...card({ padding: '18px 20px' }) }}>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Platform-wide settings will live here as they're needed — for now there's a single church on this deployment, so nothing platform-level to configure yet. Per-church settings (service days, structure, labels) are configured by each church in their own Settings tab.
            </div>
          </div>
        )}

        {sidebarTab === 'churches' && (<>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Total churches', value: stats.total, color: C.purple },
            { label: 'On trial', value: stats.trial, color: C.amber },
            { label: 'Active paid', value: stats.active, color: C.teal },
            { label: 'Expired', value: stats.expired, color: C.coral },
            { label: 'Growth plan', value: stats.growth, color: C.purple },
            { label: 'Starter plan', value: stats.starter, color: C.teal },
          ].map((s, i) => (
            <div key={i} style={{ ...card({ padding: '14px 16px' }) }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Church list */}
          <div style={{ flex: 1 }}>
            <div style={{ ...card({ padding: 0, overflow: 'hidden' }) }}>
              <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>All Churches ({churches.length})</div>
              </div>
              {churches.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No churches onboarded yet.</div>
              ) : (
                churches.map((church, i) => {
                  const planC = PLAN_COLORS[church.plan_tier] || PLAN_COLORS.trial;
                  const statusC = STATUS_COLORS[church.subscription_status] || STATUS_COLORS.trial;
                  const isSelected = selected?.id === church.id;
                  return (
                    <div key={church.id} onClick={() => selectChurch(church)}
                      style={{ padding: '14px 18px', borderBottom: i < churches.length - 1 ? `0.5px solid ${C.border}` : 'none', cursor: 'pointer', background: isSelected ? C.purpleBg : 'transparent', transition: 'background 0.12s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>{church.church_name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{church.country} · {church.structure_type?.replace('_', ' ')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: planC.bg, color: planC.color }}>
                            {(church.plan_tier || 'trial').toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10, color: C.muted }}>
                            {church.subscription_status === 'trial' ? `${church.trial_days_remaining ?? '—'}d left` : church.subscription_status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ width: 380, flexShrink: 0 }}>
              <div style={{ ...card({ padding: 0, overflow: 'hidden', position: 'sticky', top: 0 }) }}>
                {/* Church header */}
                <div style={{ padding: '18px 20px', borderBottom: `0.5px solid ${C.border}`, background: C.purpleBg }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selected.church_name}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{selected.country} · Onboarded {new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 600, background: (PLAN_COLORS[selected.plan_tier] || PLAN_COLORS.trial).bg, color: (PLAN_COLORS[selected.plan_tier] || PLAN_COLORS.trial).color }}>
                      {(selected.plan_tier || 'trial').toUpperCase()} PLAN
                    </span>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 600, background: (STATUS_COLORS[selected.subscription_status] || STATUS_COLORS.trial).bg, color: (STATUS_COLORS[selected.subscription_status] || STATUS_COLORS.trial).color }}>
                      {(selected.subscription_status || 'trial').toUpperCase()}
                    </span>
                    {selected.subscription_status === 'trial' && (
                      <span style={{ fontSize: 10, color: C.muted, padding: '3px 0' }}>{selected.trial_days_remaining ?? '—'} days left</span>
                    )}
                  </div>
                </div>

                {/* Tab nav */}
                <div style={{ display: 'flex', borderBottom: `0.5px solid ${C.border}` }}>
                  {(['overview', 'profile', 'goals', 'notes'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      style={{ flex: 1, padding: '10px 4px', border: 'none', borderBottom: `2px solid ${tab === t ? C.purple : 'transparent'}`, background: tab === t ? C.purpleBg : 'transparent', fontSize: 11, fontWeight: tab === t ? 600 : 400, color: tab === t ? C.purple : C.muted, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {t}
                    </button>
                  ))}
                </div>

                <div style={{ padding: '16px 20px', maxHeight: 480, overflowY: 'auto' }}>
                  {tab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: 'Structure', value: `${selected.tier1_label || '—'} → ${selected.tier2_label || '—'} → Member` },
                        { label: 'Structure type', value: selected.structure_type?.replace(/_/g, ' ') || '—' },
                        { label: 'Congregation size', value: selected.church_profile?.congregation_size as string || '—' },
                        { label: 'Locations', value: selected.church_profile?.location_count as string || '—' },
                        { label: 'Staff', value: selected.church_profile?.staff_count as string || '—' },
                        { label: 'Denomination', value: selected.church_profile?.denomination as string || '—' },
                        { label: 'Founded', value: selected.church_profile?.founded_year as string || '—' },
                        { label: 'Online giving', value: selected.church_profile?.online_giving as string || '—' },
                        { label: 'Primary comms', value: ((selected.church_profile?.primary_comms as string[]) || []).join(', ') || '—' },
                      ].map((row, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{row.label}</div>
                          <div style={{ fontSize: 12, color: C.text, textAlign: 'right', textTransform: 'capitalize' }}>{String(row.value).replace(/_/g, ' ')}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === 'profile' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>Departments</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {((selected.church_profile?.departments as string[]) || []).map((d, i) => (
                          <span key={i} style={{ fontSize: 10, background: C.purpleBg, color: C.purple, borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize' }}>{d.replace(/_/g, ' ')}</span>
                        ))}
                        {!selected.church_profile?.departments && <span style={{ fontSize: 12, color: C.muted }}>Not specified</span>}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 8, marginBottom: 4 }}>Giving types</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {((selected.church_profile?.giving_types as string[]) || []).map((g, i) => (
                          <span key={i} style={{ fontSize: 10, background: C.tealBg, color: C.teal, borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize' }}>{g.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 8, marginBottom: 4 }}>Service days</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {((selected.church_profile as Record<string, unknown>)?.service_days as string[] || []).map((d, i) => (
                          <span key={i} style={{ fontSize: 10, background: C.amberBg, color: C.amber, borderRadius: 6, padding: '2px 8px' }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === 'goals' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>Top priorities</div>
                      {((selected.church_profile?.primary_goals as string[]) || []).map((g, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.text, padding: '6px 10px', background: C.purpleBg, borderRadius: 7, textTransform: 'capitalize' }}>
                          {g.replace(/_/g, ' ')}
                        </div>
                      ))}
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 8, marginBottom: 4 }}>Operational challenges</div>
                      {((selected.church_profile?.biggest_challenge as string[]) || []).map((c, i) => (
                        <div key={i} style={{ fontSize: 12, color: C.coral, padding: '6px 10px', background: C.coralBg, borderRadius: 7, textTransform: 'capitalize' }}>
                          {c.replace(/_/g, ' ')}
                        </div>
                      ))}
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
                        Timeline: <span style={{ color: C.text, textTransform: 'capitalize' }}>{String(selected.church_profile?.timeline || '—').replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  )}

                  {tab === 'notes' && (
                    <div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Private notes about this church (only visible to lead tech)</div>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={8}
                        placeholder="Add notes, follow-up reminders, support history…"
                        style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <button onClick={saveNotes} disabled={savingNotes}
                        style={{ marginTop: 10, background: C.purple, color: C.white, border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingNotes ? 0.7 : 1 }}>
                        {savingNotes ? 'Saving…' : 'Save notes'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        </>)}
      </div>
    </div>
  );
}
