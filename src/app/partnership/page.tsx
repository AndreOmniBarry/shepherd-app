'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Band = { id: string; name: string; amount: number; color: string };
type Partner = {
  id: string; full_name: string; phone: string | null; email: string | null;
  band_name: string; band_amount: number; band_color: string;
  start_date: string; status: string;
  this_month_paid: boolean; months_consistent: number; total_given: number;
};

type NavTab = 'overview' | 'partners' | 'log' | 'catchup' | 'lapsed';

const MONTHS_2026 = [
  { value: '2026-01-01', label: 'January 2026' },
  { value: '2026-02-01', label: 'February 2026' },
  { value: '2026-03-01', label: 'March 2026' },
  { value: '2026-04-01', label: 'April 2026' },
  { value: '2026-05-01', label: 'May 2026' },
  { value: '2026-06-01', label: 'June 2026' },
];

const BAND_CONFIG: Record<string, { color: string; bg: string; text: string }> = {
  'Silver':   { color: '#9E9E9E', bg: '#F5F5F5', text: '#424242' },
  'Gold':     { color: '#FFC107', bg: '#FFF8E1', text: '#F57F17' },
  'Platinum': { color: '#00BCD4', bg: '#E0F7FA', text: '#006064' },
  'Diamond':  { color: '#9C27B0', bg: '#F3E5F5', text: '#4A148C' },
};

export default function PartnershipPage() {
  const router = useRouter();
  const [tab, setTab] = useState<NavTab>('partners');
  const [dark, setDark] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [bands, setBands] = useState<Band[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bandFilter, setBandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  // Add partner form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPartner, setNewPartner] = useState({ full_name: '', phone: '', email: '', band_id: '', start_date: new Date().toISOString().split('T')[0] });
  const [addingPartner, setAddingPartner] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // Log giving
  const [givingForm, setGivingForm] = useState({ partner_id: '', amount: '', month: new Date().toISOString().slice(0, 7), status: 'paid', notes: '' });
  const [givingSubmitting, setGivingSubmitting] = useState(false);
  const [givingSuccess, setGivingSuccess] = useState(false);

  // Catch-up: log historical giving
  const [catchupPartner, setCatchupPartner] = useState('');
  const [catchupMonth, setCatchupMonth] = useState(MONTHS_2026[0].value);
  const [catchupAmount, setCatchupAmount] = useState('');
  const [catchupStatus, setCatchupStatus] = useState('paid');
  const [catchupNotes, setCatchupNotes] = useState('');
  const [catchupSubmitting, setCatchupSubmitting] = useState(false);
  const [catchupSuccess, setCatchupSuccess] = useState(false);

  const t = {
    bg: dark ? '#080614' : '#F0EFF8', card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC', input: dark ? '#0F0C20' : '#F7F6FF',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    coral: dark ? '#F87171' : '#D85A30', coralBg: dark ? '#1F0A0A' : '#FAECE7',
    amber: dark ? '#FCD34D' : '#BA7517', amberBg: dark ? '#1F1A00' : '#FAEEDA',
    navBg: dark ? '#0A0618' : '#FFFFFF', navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
  };

  const card = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px', ...e });
  const fmtNGN = (n: number) => n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `₦${(n / 1000).toFixed(0)}k` : `₦${Math.round(n).toLocaleString()}`;

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (!data) { router.push('/login'); return; } setLeaderName(data.name || ''); })
      .catch(() => router.push('/login'));

    Promise.all([
      fetch('/api/partnership/bands', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/partnership/partners', { credentials: 'include' }).then(r => r.json()),
    ]).then(([bandsRes, partnersRes]) => {
      if (bandsRes.data?.bands) setBands(bandsRes.data.bands);
      if (partnersRes.data?.partners) setPartners(partnersRes.data.partners);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  async function addPartner() {
    if (!newPartner.full_name || !newPartner.band_id) return;
    setAddingPartner(true);
    try {
      const res = await fetch('/api/partnership/partners', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(newPartner),
      });
      if (res.ok) {
        setAddSuccess(true);
        setNewPartner({ full_name: '', phone: '', email: '', band_id: '', start_date: new Date().toISOString().split('T')[0] });
        setShowAddForm(false);
        setTimeout(() => setAddSuccess(false), 3000);
        fetch('/api/partnership/partners', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.partners) setPartners(data.partners); });
      }
    } catch {}
    setAddingPartner(false);
  }

  async function logGiving(isCatchup = false) {
    const form = isCatchup
      ? { partner_id: catchupPartner, amount: catchupAmount, month: catchupMonth.slice(0, 7) + '-01', status: catchupStatus, notes: catchupNotes }
      : { partner_id: givingForm.partner_id, amount: givingForm.amount, month: givingForm.month + '-01', status: givingForm.status, notes: givingForm.notes };

    if (!form.partner_id || !form.amount) return;
    if (isCatchup) setCatchupSubmitting(true); else setGivingSubmitting(true);

    try {
      const res = await fetch('/api/partnership/giving', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        if (isCatchup) {
          setCatchupSuccess(true);
          setCatchupAmount(''); setCatchupNotes('');
          setTimeout(() => setCatchupSuccess(false), 3000);
        } else {
          setGivingSuccess(true);
          setGivingForm({ partner_id: '', amount: '', month: new Date().toISOString().slice(0, 7), status: 'paid', notes: '' });
          setTimeout(() => setGivingSuccess(false), 3000);
        }
        fetch('/api/partnership/partners', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.partners) setPartners(data.partners); });
      }
    } catch {}
    if (isCatchup) setCatchupSubmitting(false); else setGivingSubmitting(false);
  }

  const activePartners = partners.filter(p => p.status === 'active');
  const lapsedPartners = partners.filter(p => p.status === 'lapsed');
  const paidThisMonth = activePartners.filter(p => p.this_month_paid).length;
  const totalMonthly = activePartners.reduce((a, p) => a + p.band_amount, 0);
  const totalCollected = partners.reduce((a, p) => a + p.total_given, 0);
  const collectionRate = activePartners.length > 0 ? Math.round((paidThisMonth / activePartners.length) * 100) : 0;

  const filteredPartners = partners.filter(p => {
    const matchSearch = search ? p.full_name.toLowerCase().includes(search.toLowerCase()) : true;
    const matchBand = bandFilter !== 'all' ? p.band_name === bandFilter : true;
    const matchStatus = statusFilter === 'active' ? p.status === 'active' : true;
    return matchSearch && matchBand && matchStatus;
  });

  const bandBreakdown = ['Silver', 'Gold', 'Platinum', 'Diamond'].map(bName => {
    const bc = BAND_CONFIG[bName];
    const bandPartners = activePartners.filter(p => p.band_name === bName);
    const band = bands.find(b => b.name === bName);
    return {
      name: bName,
      count: bandPartners.length,
      monthly: bandPartners.reduce((a, p) => a + p.band_amount, 0),
      paid: bandPartners.filter(p => p.this_month_paid).length,
      amount: band?.amount || 0,
      ...bc,
    };
  });

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'partners', label: `Partners (${activePartners.length})` },
    { id: 'overview', label: 'Overview' },
    { id: 'log', label: 'Log giving' },
    { id: 'catchup', label: 'Historical entries' },
    { id: 'lapsed', label: `Lapsed (${lapsedPartners.length})` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Inter,system-ui,sans-serif' }}>
      {/* Topbar */}
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 3, height: 17, background: '#A89FFF', borderRadius: 2 }} />
            <div style={{ position: 'absolute', width: 12, height: 3, background: '#A89FFF', borderRadius: 2 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 10, color: t.muted }}>Partnership{leaderName ? ` · ${leaderName}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell dark={dark} />
          <div onClick={() => setDark(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>{dark ? '☀' : '◑'}</div>
          <button onClick={logout} style={{ background: 'transparent', color: t.muted, border: 'none', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', display: 'flex', overflowX: 'auto' }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            style={{ padding: '10px 16px', border: 'none', borderBottom: `2px solid ${tab === n.id ? t.purple : 'transparent'}`, background: 'transparent', fontSize: 12, fontWeight: tab === n.id ? 600 : 400, color: tab === n.id ? t.purple : t.muted, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -0.5 }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── PARTNERS (primary view) ── */}
        {tab === 'partners' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {addSuccess && <div style={{ background: t.tealBg, borderRadius: 9, border: `0.5px solid rgba(29,158,117,0.2)`, padding: '10px 14px', fontSize: 12, color: t.teal, fontWeight: 500 }}>Partner added successfully.</div>}

            {/* Filters and add button */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search partners..."
                style={{ flex: 1, minWidth: 160, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
              <select value={bandFilter} onChange={e => setBandFilter(e.target.value)}
                style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                <option value="all">All bands</option>
                {['Silver', 'Gold', 'Platinum', 'Diamond'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                <option value="active">Active only</option>
                <option value="all">All partners</option>
              </select>
              <button onClick={() => setShowAddForm(v => !v)}
                style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                + Add partner
              </button>
            </div>

            {/* Add partner form */}
            {showAddForm && (
              <div style={card()}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>New partner details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  {[
                    { key: 'full_name', label: 'Full name *', placeholder: 'First and last name' },
                    { key: 'phone', label: 'Phone number', placeholder: '08012345678' },
                    { key: 'email', label: 'Email (optional)', placeholder: 'Optional' },
                    { key: 'start_date', label: 'Partnership start date', placeholder: '', type: 'date' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{f.label}</div>
                      <input type={f.type || 'text'} value={newPartner[f.key as keyof typeof newPartner]} onChange={e => setNewPartner(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Partnership band *</div>
                    <select value={newPartner.band_id} onChange={e => setNewPartner(p => ({ ...p, band_id: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                      <option value="">Select band</option>
                      {bands.map(b => <option key={b.id} value={b.id}>{b.name} — ₦{b.amount.toLocaleString()}/month</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addPartner} disabled={addingPartner || !newPartner.full_name || !newPartner.band_id}
                    style={{ flex: 1, background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: addingPartner || !newPartner.full_name || !newPartner.band_id ? 0.6 : 1 }}>
                    {addingPartner ? 'Adding...' : 'Add partner'}
                  </button>
                  <button onClick={() => setShowAddForm(false)}
                    style={{ background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '10px 16px', fontSize: 12, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Partners table */}
            <div style={{ ...card({ padding: 0 }), overflow: 'hidden' }}>
              <div style={{ padding: '11px 16px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{filteredPartners.length} partner{filteredPartners.length !== 1 ? 's' : ''}</div>
                <div style={{ fontSize: 11, color: t.muted }}>This month: {paidThisMonth}/{activePartners.length} paid</div>
              </div>
              {filteredPartners.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: t.muted, fontSize: 13 }}>No partners found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                      {['Name', 'Band', 'Monthly pledge', 'This month', 'Total given', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartners.map((p, i) => {
                      const bc = BAND_CONFIG[p.band_name] || { color: t.purple, bg: t.purpleBg, text: t.purple };
                      return (
                        <tr key={p.id} style={{ borderBottom: i < filteredPartners.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 500, color: t.text }}>{p.full_name}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: bc.bg, color: bc.text, fontWeight: 600 }}>{p.band_name}</span>
                          </td>
                          <td style={{ padding: '10px 12px', color: t.purple, fontWeight: 500 }}>₦{p.band_amount.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: p.this_month_paid ? t.tealBg : t.coralBg, color: p.this_month_paid ? t.teal : t.coral, fontWeight: 500 }}>
                              {p.this_month_paid ? 'Paid' : 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: t.teal, fontWeight: 500 }}>{fmtNGN(p.total_given)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: p.status === 'active' ? t.tealBg : t.coralBg, color: p.status === 'active' ? t.teal : t.coral, fontWeight: 500 }}>
                              {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Active partners', value: activePartners.length, sub: `${lapsedPartners.length} lapsed`, accent: '#534AB7' },
                { label: 'Monthly target', value: fmtNGN(totalMonthly), sub: 'If all active pay', accent: '#1D9E75' },
                { label: 'Collection rate', value: `${collectionRate}%`, sub: `${paidThisMonth}/${activePartners.length} paid this month`, accent: collectionRate >= 80 ? '#1D9E75' : collectionRate >= 60 ? '#BA7517' : '#D85A30' },
                { label: 'Total collected', value: fmtNGN(totalCollected), sub: 'All time', accent: '#9C27B0' },
              ].map(k => (
                <div key={k.label} style={{ ...card({ padding: '12px 14px' }), borderTop: `2.5px solid ${k.accent}` }}>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Band breakdown */}
            <div style={card()}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 14 }}>Band breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {bandBreakdown.map(b => (
                  <div key={b.name} style={{ background: b.bg, borderRadius: 10, padding: '14px', textAlign: 'center', border: `0.5px solid ${b.color}22` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: b.color, marginBottom: 6 }}>{b.name}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: b.text }}>{b.count}</div>
                    <div style={{ fontSize: 10, color: b.color, opacity: 0.7, marginBottom: 6 }}>partners</div>
                    <div style={{ fontSize: 10, color: b.text, opacity: 0.6 }}>₦{b.amount.toLocaleString()}/mo</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: b.color, marginTop: 4 }}>{fmtNGN(b.monthly)}/mo</div>
                    <div style={{ fontSize: 10, color: b.text, opacity: 0.5, marginTop: 4 }}>{b.paid}/{b.count} paid this month</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lapsed alert */}
            {lapsedPartners.length > 0 && (
              <div style={{ background: t.coralBg, borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(216,90,48,0.2)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.coral, marginBottom: 6 }}>⚠ {lapsedPartners.length} lapsed partner{lapsedPartners.length > 1 ? 's' : ''} — follow up needed</div>
                {lapsedPartners.slice(0, 3).map(p => (
                  <div key={p.id} style={{ fontSize: 12, color: t.coral, opacity: 0.8 }}>{p.full_name} — {p.band_name}{p.phone ? ` · ${p.phone}` : ''}</div>
                ))}
                {lapsedPartners.length > 3 && <div style={{ fontSize: 11, color: t.coral, opacity: 0.6, marginTop: 4 }}>+{lapsedPartners.length - 3} more — see Lapsed tab</div>}
              </div>
            )}
          </div>
        )}

        {/* ── LOG GIVING ── */}
        {tab === 'log' && (
          <div style={card()}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Log this month's partnership giving</div>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 16, lineHeight: 1.5 }}>For current month payments. Use the Historical entries tab for January to June 2026 catch-up.</div>

            {givingSuccess && <div style={{ background: t.tealBg, borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: t.teal, fontWeight: 500 }}>Giving record saved.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Partner *</div>
                <select value={givingForm.partner_id} onChange={e => {
                  const partner = partners.find(p => p.id === e.target.value);
                  setGivingForm(prev => ({ ...prev, partner_id: e.target.value, amount: partner ? String(partner.band_amount) : '' }));
                }}
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                  <option value="">Select partner</option>
                  {activePartners.map(p => <option key={p.id} value={p.id}>{p.full_name} — {p.band_name} (₦{p.band_amount.toLocaleString()}/mo)</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Amount (₦) *</div>
                  <input type="number" value={givingForm.amount} onChange={e => setGivingForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: 600, background: t.input, color: t.teal, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Month *</div>
                  <input type="month" value={givingForm.month} onChange={e => setGivingForm(p => ({ ...p, month: e.target.value }))}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Payment status</div>
                <select value={givingForm.status} onChange={e => setGivingForm(p => ({ ...p, status: e.target.value }))}
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                  <option value="paid">Paid in full</option>
                  <option value="partial">Partial payment</option>
                  <option value="missed">Missed this month</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Notes (optional)</div>
                <input value={givingForm.notes} onChange={e => setGivingForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Bank transfer, pledged to pay balance next week..."
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <button onClick={() => logGiving(false)} disabled={givingSubmitting || !givingForm.partner_id || !givingForm.amount}
                style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: givingSubmitting || !givingForm.partner_id || !givingForm.amount ? 0.6 : 1 }}>
                {givingSubmitting ? 'Saving...' : 'Save giving record'}
              </button>
            </div>
          </div>
        )}

        {/* ── HISTORICAL CATCH-UP ── */}
        {tab === 'catchup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Historical giving catch-up</div>
              <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
                Log partnership giving records from January to June 2026. Select the partner, the month, and enter the amount paid. This backdates the record without triggering any alerts.
              </div>
            </div>

            {catchupSuccess && <div style={{ background: t.tealBg, borderRadius: 9, border: `0.5px solid rgba(29,158,117,0.2)`, padding: '10px 14px', fontSize: 12, color: t.teal, fontWeight: 500 }}>Historical record saved.</div>}

            <div style={card()}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Partner *</div>
                  <select value={catchupPartner} onChange={e => {
                    const partner = partners.find(p => p.id === e.target.value);
                    setCatchupPartner(e.target.value);
                    if (partner) setCatchupAmount(String(partner.band_amount));
                  }}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                    <option value="">Select partner</option>
                    {partners.filter(p => p.status === 'active').map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} — {p.band_name} (₦{p.band_amount.toLocaleString()}/mo)</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Month *</div>
                    <select value={catchupMonth} onChange={e => setCatchupMonth(e.target.value)}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                      {MONTHS_2026.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Amount paid (₦) *</div>
                    <input type="number" value={catchupAmount} onChange={e => setCatchupAmount(e.target.value)}
                      placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: 600, background: t.input, color: t.teal, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Status</div>
                  <select value={catchupStatus} onChange={e => setCatchupStatus(e.target.value)}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                    <option value="paid">Paid in full</option>
                    <option value="partial">Partial payment</option>
                    <option value="missed">Not paid — missed this month</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Notes</div>
                  <input value={catchupNotes} onChange={e => setCatchupNotes(e.target.value)}
                    placeholder="Optional notes about this historical entry..."
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <button onClick={() => logGiving(true)} disabled={catchupSubmitting || !catchupPartner || !catchupAmount}
                  style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: catchupSubmitting || !catchupPartner || !catchupAmount ? 0.6 : 1 }}>
                  {catchupSubmitting ? 'Saving...' : 'Save historical record'}
                </button>
              </div>
            </div>

            <div style={{ background: t.purpleBg, borderRadius: 10, padding: '11px 14px', border: `0.5px solid rgba(83,74,183,0.15)`, fontSize: 11, color: t.purple, lineHeight: 1.6 }}>
              Historical records do not trigger lapse alerts. They are purely for building an accurate giving history from January 2026. Go through each partner month by month from your manual records.
            </div>
          </div>
        )}

        {/* ── LAPSED ── */}
        {tab === 'lapsed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6, marginBottom: 4 }}>
              Partners who have missed 2 or more consecutive months. Reach out to restore their commitment.
            </div>
            {lapsedPartners.length === 0 ? (
              <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 13, color: t.teal, fontWeight: 500 }}>No lapsed partners — excellent retention!</div>
              </div>
            ) : (
              lapsedPartners.map(p => {
                const bc = BAND_CONFIG[p.band_name] || { color: t.purple, bg: t.purpleBg, text: t.purple };
                return (
                  <div key={p.id} style={{ ...card({ padding: '14px 16px' }), borderLeft: `3px solid ${t.coral}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>{p.full_name}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: bc.bg, color: bc.text, fontWeight: 600 }}>{p.band_name}</span>
                          <span style={{ fontSize: 11, color: t.muted }}>₦{p.band_amount.toLocaleString()}/month pledge</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {p.phone && <div style={{ fontSize: 12, color: t.sub }}>📞 {p.phone}</div>}
                          {p.email && <div style={{ fontSize: 12, color: t.sub }}>✉ {p.email}</div>}
                          <div style={{ fontSize: 11, color: t.muted }}>Partner since {new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                          <div style={{ fontSize: 11, color: t.muted }}>Total given: {fmtNGN(p.total_given)} · {p.months_consistent} consistent months before lapse</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: t.coralBg, color: t.coral, fontWeight: 500, flexShrink: 0 }}>Lapsed</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
