'use client';
import NotificationBell from "@/components/NotificationBell";
import BirthdayPanel from '@/components/BirthdayPanel';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

type Cell = {
  id: string;
  name: string;
  leader_name: string;
  member_count: number;
  last_submission?: string;
  last_present?: number;
  last_absent?: number;
  last_rate?: number;
  sla_grade?: string;
  status: 'submitted' | 'pending' | 'overdue';
  trend: { w: string; v: number }[];
};

type Member = {
  id: string;
  full_name: string;
  membership_status: string;
  cell_name: string;
  last_seen?: string;
};

type GivingEntry = {
  id?: string;
  service_date: string;
  tithe: number;
  offering: number;
  special: number;
  project: number;
};

type Dispute = {
  id: string;
  cell_name: string;
  leader_name: string;
  service_date: string;
  original_present: number;
  original_absent: number;
  dispute_reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  submitted_at: string;
};

type NavTab = 'overview' | 'cells' | 'members' | 'giving' | 'disputes' | 'birthdays' | 'cydf';

const DISPUTE_REASONS = [
  { value: 'wrong_count', label: 'Wrong attendance count' },
  { value: 'wrong_names', label: 'Wrong members marked' },
  { value: 'visitors_miscounted', label: 'Visitors miscounted' },
  { value: 'member_marked_absent', label: 'Member marked absent who was present' },
  { value: 'other', label: 'Other inaccuracy' },
];

const SLA_COLORS: Record<string, { bg: string; text: string }> = {
  'A+': { bg: '#E1F5EE', text: '#085041' },
  'A':  { bg: '#E1F5EE', text: '#085041' },
  'B':  { bg: '#EEEDFE', text: '#3C3489' },
  'C':  { bg: '#FAEEDA', text: '#633806' },
  'D':  { bg: '#FAECE7', text: '#993C1D' },
  'F':  { bg: '#FCEBEB', text: '#A32D2D' },
  'F-': { bg: '#FCEBEB', text: '#A32D2D' },
};

export default function FellowshipHeadPage() {
  const router = useRouter();
  const [tab, setTab] = useState<NavTab>('overview');
  const [dark, setDark] = useState(false);
  const [fellowshipName, setFellowshipName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [cells, setCells] = useState<Cell[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [givingHistory, setGivingHistory] = useState<GivingEntry[]>([]);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [givingForm, setGivingForm] = useState({ tithe: '', offering: '', special: '', project: '' });
  const [givingSubmitting, setGivingSubmitting] = useState(false);
  // CYDF headcount state
  const [isCYDF, setIsCYDF] = useState(false);
  const [cydfForm, setCydfForm] = useState({ service_id: '', children_count: '', teenagers_count: '', notes: '' });
  const [cydfServices, setCydfServices] = useState<{id:string;service_date:string}[]>([]);
  const [cydfHistory, setCydfHistory] = useState<{id:string;children_count:number;teenagers_count:number;submitted_at:string;sla_grade:string;services:{service_date:string}}[]>([]);
  const [cydfSubmitting, setCydfSubmitting] = useState(false);
  const [cydfSuccess, setCydfSuccess] = useState(false);
  const [givingSuccess, setGivingSuccess] = useState(false);
  const [disputeForm, setDisputeForm] = useState<{ record_id: string; reason: string } | null>(null);

  // ── Theme ────────────────────────────────────────────────────
  const t = {
    bg:        dark ? '#080614' : '#F0EFF8',
    card:      dark ? '#13102A' : '#FFFFFF',
    border:    dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text:      dark ? '#E8E5FF' : '#1A1040',
    sub:       dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted:     dark ? 'rgba(232,229,255,0.35)' : '#9990CC',
    input:     dark ? '#0F0C20' : '#F7F6FF',
    purple:    dark ? '#A89FFF' : '#534AB7',
    purpleBg:  dark ? '#1A1A2E' : '#EEEDFE',
    teal:      dark ? '#2DD4AA' : '#1D9E75',
    tealBg:    dark ? '#0D2620' : '#E1F5EE',
    coral:     dark ? '#F87171' : '#D85A30',
    coralBg:   dark ? '#1F0A0A' : '#FAECE7',
    amber:     dark ? '#FCD34D' : '#BA7517',
    amberBg:   dark ? '#1F1A00' : '#FAEEDA',
    navBg:     dark ? '#0A0618' : '#FFFFFF',
    navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
    chartGrid: dark ? '#2A2A2A' : '#F0F0F0',
    chartAxis: dark ? '#888888' : '#6B7280',
    chartTip:  dark ? '#141414' : '#FFFFFF',
    chartTipText: dark ? '#FFFFFF' : '#374151',
  };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`,
    borderRadius: 12, padding: '16px 18px', ...extra,
  });

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        setFellowshipName(data.fellowship_name || 'Your Fellowship');
        setLeaderName(data.name || '');
      })
      .catch(() => router.push('/login'));

    // Load cells in fellowship
    // Check if this is CYDF fellowship
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.fellowship_id === 'cb72d6c2-a206-45b9-895c-a26d705d2367') {
          setIsCYDF(true);
          fetch('/api/fellowship/cydf-headcount', { credentials: 'include' })
            .then(r => r.json())
            .then(({ data }) => {
              if (data?.history) setCydfHistory(data.history);
              if (data?.services) { setCydfServices(data.services); if(data.services[0]) setCydfForm(p=>({...p,service_id:data.services[0].id})); }
            }).catch(()=>{});
        }
      }).catch(()=>{});

    fetch('/api/fellowship/cells', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.cells) setCells(data.cells);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load members
    fetch('/api/fellowship/members', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.members) setMembers(data.members); })
      .catch(() => {});

    // Load giving history
    fetch('/api/fellowship/giving', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.records) setGivingHistory(data.records); })
      .catch(() => {});

    // Load disputes
    fetch('/api/fellowship/disputes', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.disputes) setDisputes(data.disputes); })
      .catch(() => {});
  }, [router]);

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  // ── Computed stats ───────────────────────────────────────────
  const totalMembers = cells.reduce((a, c) => a + c.member_count, 0);
  const submittedCells = cells.filter(c => c.status === 'submitted').length;
  const pendingCells = cells.filter(c => c.status === 'pending').length;
  const overdueCells = cells.filter(c => c.status === 'overdue').length;
  const avgRate = cells.length > 0
    ? Math.round(cells.filter(c => c.last_rate).reduce((a, c) => a + (c.last_rate || 0), 0) / cells.filter(c => c.last_rate).length)
    : 0;

  const ytdGiving = givingHistory.reduce((a, g) => a + g.tithe + g.offering + g.special + g.project, 0);

  async function submitCYDF() {
    if (!cydfForm.service_id) return;
    setCydfSubmitting(true);
    try {
      const res = await fetch('/api/fellowship/cydf-headcount', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(cydfForm),
      });
      if (res.ok) {
        setCydfSuccess(true);
        setTimeout(() => setCydfSuccess(false), 4000);
        fetch('/api/fellowship/cydf-headcount', { credentials: 'include' })
          .then(r => r.json())
          .then(({ data }) => { if (data?.history) setCydfHistory(data.history); });
      }
    } catch {}
    setCydfSubmitting(false);
  }

  async function submitGiving() {
    const { tithe, offering, special, project } = givingForm;
    if (!tithe && !offering && !special && !project) return;
    setGivingSubmitting(true);
    try {
      const res = await fetch('/api/fellowship/giving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tithe: parseFloat(tithe) || 0,
          offering: parseFloat(offering) || 0,
          special: parseFloat(special) || 0,
          project: parseFloat(project) || 0,
          service_date: new Date().toISOString().split('T')[0],
        }),
      });
      if (res.ok) {
        setGivingSuccess(true);
        setGivingForm({ tithe: '', offering: '', special: '', project: '' });
        setTimeout(() => setGivingSuccess(false), 4000);
      }
    } catch {}
    setGivingSubmitting(false);
  }

  async function raiseDispute(recordId: string, reason: string) {
    try {
      await fetch('/api/fellowship/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ record_id: recordId, reason }),
      });
      setDisputeForm(null);
      // Reload disputes
      fetch('/api/fellowship/disputes', { credentials: 'include' })
        .then(r => r.json())
        .then(({ data }) => { if (data?.disputes) setDisputes(data.disputes); });
    } catch {}
  }

  const fmtNGN = (n: number) => n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `₦${(n / 1000).toFixed(0)}k` : `₦${n}`;
  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const filteredMembers = members.filter(m =>
    memberSearch ? m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) : true
  );

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'ti-layout-dashboard' },
    { id: 'cells', label: 'Cells', icon: 'ti-circles' },
    { id: 'members', label: 'Members', icon: 'ti-users' },
    { id: 'giving', label: 'Giving', icon: 'ti-coin' },
    { id: 'birthdays', label: '🎂 Birthdays' },
      { id: 'cydf', label: 'CYDF Headcount' },
      { id: 'disputes', label: `Disputes${disputes.filter(d => d.status === 'pending').length > 0 ? ` (${disputes.filter(d => d.status === 'pending').length})` : ''}` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* ── Topbar ── */}
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ position: 'absolute', width: 3, height: 17, background: '#A89FFF', borderRadius: 2 }} />
            <div style={{ position: 'absolute', width: 12, height: 3, background: '#A89FFF', borderRadius: 2 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 10, color: t.muted }}>{fellowshipName} Fellowship{leaderName ? ` · ${leaderName}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: t.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal, display: 'inline-block' }} />
            Live
          </div>
          <div onClick={() => setDark(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>
            {dark ? '☀' : '◑'}
          </div>
          <NotificationBell dark={dark} /><button onClick={logout} style={{ background: "transparent", color: t.muted, border: "none", fontSize: 12, cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      {/* ── Sub-nav ── */}
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            style={{ padding: '10px 16px', border: 'none', borderBottom: `2px solid ${tab === n.id ? t.purple : 'transparent'}`, background: 'transparent', fontSize: 12, fontWeight: tab === n.id ? 600 : 400, color: tab === n.id ? t.purple : t.muted, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -0.5 }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div>
            {/* Greeting */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}{leaderName ? `, ${leaderName.split(' ')[0]}` : ''}
              </div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }} suppressHydrationWarning>{todayStr}</div>
            </div>

            {/* Submission status banner */}
            <div style={{ background: overdueCells > 0 ? t.coralBg : pendingCells > 0 ? t.amberBg : t.tealBg, borderRadius: 10, padding: '10px 14px', marginBottom: 18, border: `0.5px solid ${overdueCells > 0 ? 'rgba(216,90,48,0.2)' : pendingCells > 0 ? 'rgba(186,117,23,0.2)' : 'rgba(29,158,117,0.2)'}` }}>
              <div style={{ fontSize: 12, color: overdueCells > 0 ? t.coral : pendingCells > 0 ? t.amber : t.teal, fontWeight: 500 }}>
                {overdueCells > 0
                  ? `${overdueCells} cell${overdueCells > 1 ? 's' : ''} overdue — submission window closing soon`
                  : pendingCells > 0
                  ? `${pendingCells} cell${pendingCells > 1 ? 's' : ''} pending — remind your leaders to submit`
                  : `All ${submittedCells} cells submitted for this Sunday`}
              </div>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Total members', value: totalMembers, accent: '#534AB7', sub: `${cells.length} cells` },
                { label: 'Avg attendance', value: `${avgRate}%`, accent: '#1D9E75', sub: 'Last Sunday' },
                { label: 'Submitted', value: `${submittedCells}/${cells.length}`, accent: '#BA7517', sub: 'This Sunday' },
                { label: 'YTD giving', value: fmtNGN(ytdGiving), accent: '#D85A30', sub: 'All types' },
              ].map(k => (
                <div key={k.label} style={{ ...card(), borderTop: `2.5px solid ${k.accent}` }}>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: t.text, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Cells needing attention */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={card()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Cell submission status</span>
                  <span style={{ fontSize: 11, color: t.purple, cursor: 'pointer' }} onClick={() => setTab('cells')}>View all</span>
                </div>
                {cells.slice(0, 6).map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `0.5px solid ${t.border}` }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: t.muted }}>{c.leader_name}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: c.status === 'submitted' ? t.tealBg : c.status === 'pending' ? t.amberBg : t.coralBg, color: c.status === 'submitted' ? t.teal : c.status === 'pending' ? t.amber : t.coral }}>
                      {c.status === 'submitted' ? `Submitted · ${c.sla_grade || ''}` : c.status === 'pending' ? 'Pending' : 'Overdue'}
                    </span>
                  </div>
                ))}
              </div>

              <div style={card()}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Attendance trend — last 8 weeks</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={cells[0]?.trend || []} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} />
                    <XAxis dataKey="w" tick={{ fontSize: 9, fill: t.chartAxis }} />
                    <YAxis tick={{ fontSize: 9, fill: t.chartAxis }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${t.border}`, background: t.chartTip, color: t.chartTipText }} />
                    <Line type="monotone" dataKey="v" stroke="#534AB7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── CELLS ── */}
        {tab === 'cells' && (
          <div>
            {selectedCell ? (
              <div>
                <button onClick={() => setSelectedCell(null)} style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 16, fontWeight: 500 }}>← Back to cells</button>
                <div style={card({ marginBottom: 14 })}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>{selectedCell.name}</div>
                  <div style={{ fontSize: 12, color: t.sub, marginBottom: 16 }}>Leader: {selectedCell.leader_name} · {selectedCell.member_count} members</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Last present', value: selectedCell.last_present ?? '—', color: t.teal, bg: t.tealBg },
                      { label: 'Last absent', value: selectedCell.last_absent ?? '—', color: t.coral, bg: t.coralBg },
                      { label: 'Rate', value: selectedCell.last_rate ? `${selectedCell.last_rate}%` : '—', color: t.purple, bg: t.purpleBg },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={selectedCell.trend} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} />
                      <XAxis dataKey="w" tick={{ fontSize: 9, fill: t.chartAxis }} />
                      <YAxis tick={{ fontSize: 9, fill: t.chartAxis }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${t.border}`, background: t.chartTip, color: t.chartTipText }} />
                      <Bar dataKey="v" fill="#534AB7" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Dispute button */}
                {selectedCell.status === 'submitted' && (
                  <div style={card()}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8 }}>Flag report inaccuracy</div>
                    <div style={{ fontSize: 12, color: t.sub, marginBottom: 12 }}>If this cell's submission appears inaccurate, raise a dispute for the PA to review. You have 48 hours from submission.</div>
                    {disputeForm?.record_id === selectedCell.id ? (
                      <div>
                        <select value={disputeForm.reason} onChange={e => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                          style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, marginBottom: 10, outline: 'none' }}>
                          <option value="">Select reason</option>
                          {DISPUTE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => disputeForm.reason && raiseDispute(selectedCell.id, disputeForm.reason)}
                            style={{ flex: 1, background: t.coral, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                            Submit dispute
                          </button>
                          <button onClick={() => setDisputeForm(null)}
                            style={{ background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setDisputeForm({ record_id: selectedCell.id, reason: '' })}
                        style={{ background: t.coralBg, color: t.coral, border: `0.5px solid rgba(216,90,48,0.2)`, borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                        Raise dispute
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Total cells', value: cells.length, accent: '#534AB7' },
                    { label: 'Submitted', value: submittedCells, accent: '#1D9E75' },
                    { label: 'Pending / Overdue', value: pendingCells + overdueCells, accent: '#D85A30' },
                  ].map(k => (
                    <div key={k.label} style={{ ...card({ padding: '12px 14px' }), borderTop: `2.5px solid ${k.accent}` }}>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ ...card({ padding: 0 }), overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                        {['Cell', 'Leader', 'Members', 'Last rate', 'SLA', 'Status'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cells.map((c, i) => {
                        const sla = SLA_COLORS[c.sla_grade || ''] || null;
                        return (
                          <tr key={c.id} onClick={() => setSelectedCell(c)} style={{ borderBottom: i < cells.length - 1 ? `0.5px solid ${t.border}` : 'none', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = dark ? '#1A1635' : '#F7F6FF'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '10px 12px', fontWeight: 500, color: t.text }}>{c.name}</td>
                            <td style={{ padding: '10px 12px', color: t.sub }}>{c.leader_name}</td>
                            <td style={{ padding: '10px 12px', color: t.text }}>{c.member_count}</td>
                            <td style={{ padding: '10px 12px', color: c.last_rate && c.last_rate >= 75 ? t.teal : t.coral, fontWeight: 500 }}>{c.last_rate ? `${c.last_rate}%` : '—'}</td>
                            <td style={{ padding: '10px 12px' }}>{sla ? <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: sla.bg, color: sla.text, fontWeight: 600 }}>{c.sla_grade}</span> : <span style={{ color: t.muted }}>—</span>}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: c.status === 'submitted' ? t.tealBg : c.status === 'pending' ? t.amberBg : t.coralBg, color: c.status === 'submitted' ? t.teal : c.status === 'pending' ? t.amber : t.coral }}>
                                {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {cells.length === 0 && !loading && (
                    <div style={{ padding: 32, textAlign: 'center', color: t.muted, fontSize: 13 }}>No cells assigned to your fellowship yet.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MEMBERS ── */}
        {tab === 'members' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search members..."
                style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.sub, background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px' }}>
                {filteredMembers.length} members
              </div>
            </div>
            <div style={{ ...card({ padding: 0 }), overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                    {['Name', 'Cell', 'Status', 'Last seen'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: i < filteredMembers.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 500, color: t.text }}>{m.full_name}</td>
                      <td style={{ padding: '9px 12px', color: t.sub }}>{m.cell_name}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: m.membership_status === 'active' ? t.tealBg : t.coralBg, color: m.membership_status === 'active' ? t.teal : t.coral, fontWeight: 500 }}>
                          {m.membership_status}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: t.muted }}>{m.last_seen || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMembers.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: t.muted, fontSize: 13 }}>No members found.</div>
              )}
            </div>
          </div>
        )}

        {/* ── GIVING ── */}
        {tab === 'giving' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Submit giving */}
            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Submit Sunday giving</div>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 14 }}>Enter amounts collected in your fellowship this Sunday. Submit by Monday midnight.</div>
              {givingSuccess && (
                <div style={{ background: t.tealBg, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: t.teal, fontWeight: 500 }}>Giving submitted successfully.</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { key: 'tithe', label: 'Tithe (₦)' },
                  { key: 'offering', label: 'Offering (₦)' },
                  { key: 'special', label: 'Special (₦)' },
                  { key: 'project', label: 'Project (₦)' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 10, color: t.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{f.label}</div>
                    <input
                      type="number"
                      value={givingForm[f.key as keyof typeof givingForm]}
                      onChange={e => setGivingForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder="0"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }}
                    />
                  </div>
                ))}
              </div>
              <button onClick={submitGiving} disabled={givingSubmitting}
                style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', opacity: givingSubmitting ? 0.7 : 1 }}>
                {givingSubmitting ? 'Submitting...' : 'Submit giving record'}
              </button>
            </div>

            {/* Giving history */}
            <div style={card()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Giving history</span>
                <span style={{ fontSize: 12, color: t.purple }}>YTD: {fmtNGN(ytdGiving)}</span>
              </div>
              {givingHistory.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={givingHistory.slice(-8).map(g => ({ date: g.service_date.slice(5), total: g.tithe + g.offering + g.special + g.project }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: t.chartAxis }} />
                      <YAxis tick={{ fontSize: 9, fill: t.chartAxis }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: t.chartTip, color: t.chartTipText }} formatter={(v: number) => [fmtNGN(v), 'Total']} />
                      <Bar dataKey="total" fill="#534AB7" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 14 }}>
                    {givingHistory.slice(-4).reverse().map((g, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? `0.5px solid ${t.border}` : 'none', fontSize: 12 }}>
                        <span style={{ color: t.sub }}>{new Date(g.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        <span style={{ fontWeight: 600, color: t.text }}>{fmtNGN(g.tithe + g.offering + g.special + g.project)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>No giving records yet. Submit your first record above.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'birthdays' && (
          <BirthdayPanel dark={dark} t={t} scope="fellowship" showFellowship={true} />
        )}

        {/* ── CYDF HEADCOUNT ── */}
        {tab === 'cydf' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>CYDF Headcount</div>
              <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>Submit the headcount for Children (0–12) and Teenagers (13–19) separately each Sunday.</div>
            </div>

            {cydfSuccess && (
              <div style={{ background: t.tealBg, borderRadius: 9, border: `0.5px solid rgba(29,158,117,0.2)`, padding: '10px 14px', fontSize: 12, color: t.teal, fontWeight: 500 }}>
                CYDF headcount submitted successfully.
              </div>
            )}

            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Submit this Sunday</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Service *</div>
                  <select value={cydfForm.service_id} onChange={e => setCydfForm(p => ({ ...p, service_id: e.target.value }))}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                    {cydfServices.map(s => (
                      <option key={s.id} value={s.id}>{new Date(s.service_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Children present (0–12) *</div>
                    <input type="number" min="0" value={cydfForm.children_count} onChange={e => setCydfForm(p => ({ ...p, children_count: e.target.value }))}
                      placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: 600, background: t.input, color: t.teal, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Teenagers present (13–19) *</div>
                    <input type="number" min="0" value={cydfForm.teenagers_count} onChange={e => setCydfForm(p => ({ ...p, teenagers_count: e.target.value }))}
                      placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: 600, background: t.input, color: t.purple, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Notes (optional)</div>
                  <input value={cydfForm.notes} onChange={e => setCydfForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="e.g. special programme, low attendance reason..."
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <button onClick={submitCYDF} disabled={cydfSubmitting || !cydfForm.service_id}
                  style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: cydfSubmitting ? 0.7 : 1 }}>
                  {cydfSubmitting ? 'Submitting...' : `Submit — ${cydfForm.children_count || 0} children · ${cydfForm.teenagers_count || 0} teenagers`}
                </button>
              </div>
            </div>

            {/* History */}
            {cydfHistory.length > 0 && (
              <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${t.border}`, fontSize: 12, fontWeight: 600, color: t.text }}>Submission history</div>
                {cydfHistory.map((h, i) => {
                  const total = h.children_count + h.teenagers_count;
                  const slaColors: Record<string,string> = { 'A+': t.teal, 'A': t.teal, 'B': t.purple, 'C': t.amber, 'D': t.coral, 'F': t.coral, 'F-': t.coral };
                  return (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < cydfHistory.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{(h.services as Record<string,string>)?.service_date ? new Date((h.services as Record<string,string>).service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
                        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Children: {h.children_count} · Teenagers: {h.teenagers_count} · Total: {total}</div>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: t.purpleBg, color: slaColors[h.sla_grade] || t.purple, fontWeight: 600 }}>{h.sla_grade}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DISPUTES ── */}
        {tab === 'disputes' && (
          <div>
            <div style={{ fontSize: 13, color: t.sub, marginBottom: 16 }}>
              Flag inaccurate cell submissions here. The PA will review and resolve within 48 hours. You have a 48-hour window from each submission to raise a dispute.
            </div>
            {disputes.length === 0 ? (
              <div style={{ ...card(), textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 13, color: t.muted }}>No disputes raised yet.</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Go to the Cells tab and click a submitted cell to raise a dispute.</div>
              </div>
            ) : (
              <div style={{ ...card({ padding: 0 }), overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                      {['Cell', 'Service date', 'Reason', 'Status', 'Raised'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {disputes.map((d, i) => (
                      <tr key={d.id} style={{ borderBottom: i < disputes.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 500, color: t.text }}>{d.cell_name}</td>
                        <td style={{ padding: '9px 12px', color: t.sub }}>{new Date(d.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                        <td style={{ padding: '9px 12px', color: t.sub }}>{DISPUTE_REASONS.find(r => r.value === d.dispute_reason)?.label || d.dispute_reason}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: d.status === 'resolved' ? t.tealBg : d.status === 'dismissed' ? t.purpleBg : t.amberBg, color: d.status === 'resolved' ? t.teal : d.status === 'dismissed' ? t.purple : t.amber }}>
                            {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', color: t.muted }}>{new Date(d.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
