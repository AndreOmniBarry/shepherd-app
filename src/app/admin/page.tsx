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
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [stats, setStats] = useState({ total: 0, trial: 0, active: 0, expired: 0, growth: 0, starter: 0 });

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
  }, []);

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
          {[{ label: 'Churches', active: true }, { label: 'Plans & Billing' }, { label: 'Alerts' }, { label: 'Settings' }].map((item, i) => (
            <div key={i} style={{ padding: '9px 10px', borderRadius: 7, marginBottom: 2, background: item.active ? 'rgba(255,255,255,0.1)' : 'transparent', cursor: 'pointer' }}>
              <div style={{ fontSize: 12, fontWeight: item.active ? 600 : 400, color: item.active ? C.white : 'rgba(255,255,255,0.45)' }}>{item.label}</div>
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
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Church Management</div>
          <div style={{ fontSize: 13, color: C.muted }}>All onboarded churches, their structures, plans, and trial status</div>
        </div>

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
      </div>
    </div>
  );
}
