'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Band = { id: string; name: string; amount: number; color: string };
type Partner = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  band_name: string;
  band_amount: number;
  band_color: string;
  start_date: string;
  status: string;
  this_month_paid: boolean;
  months_consistent: number;
  total_given: number;
};

type NavTab = 'overview' | 'partners' | 'log' | 'lapsed';

const BAND_TIERS = [
  { name: 'Silver', amount: 3000, color: '#9E9E9E', icon: '🥈' },
  { name: 'Gold', amount: 5000, color: '#FFC107', icon: '🥇' },
  { name: 'Platinum', amount: 10000, color: '#00BCD4', icon: '💎' },
  { name: 'Diamond', amount: 20000, color: '#9C27B0', icon: '👑' },
];

export default function PartnershipPage() {
  const router = useRouter();
  const [tab, setTab] = useState<NavTab>('overview');
  const [dark, setDark] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [bands, setBands] = useState<Band[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [bandFilter, setBandFilter] = useState('all');

  // New partner form
  const [newPartner, setNewPartner] = useState({ full_name: '', phone: '', email: '', band_id: '', start_date: new Date().toISOString().split('T')[0] });
  const [addingPartner, setAddingPartner] = useState(false);
  const [partnerSuccess, setPartnerSuccess] = useState(false);

  // Log giving form
  const [givingForm, setGivingForm] = useState({ partner_id: '', amount: '', month: new Date().toISOString().slice(0, 7), status: 'paid', notes: '' });
  const [givingSubmitting, setGivingSubmitting] = useState(false);
  const [givingSuccess, setGivingSuccess] = useState(false);

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
        setPartnerSuccess(true);
        setNewPartner({ full_name: '', phone: '', email: '', band_id: '', start_date: new Date().toISOString().split('T')[0] });
        setTimeout(() => setPartnerSuccess(false), 3000);
        fetch('/api/partnership/partners', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.partners) setPartners(data.partners); });
      }
    } catch {}
    setAddingPartner(false);
  }

  async function logGiving() {
    if (!givingForm.partner_id || !givingForm.amount) return;
    setGivingSubmitting(true);
    try {
      const res = await fetch('/api/partnership/giving', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...givingForm, month: givingForm.month + '-01' }),
      });
      if (res.ok) {
        setGivingSuccess(true);
        setGivingForm({ partner_id: '', amount: '', month: new Date().toISOString().slice(0, 7), status: 'paid', notes: '' });
        setTimeout(() => setGivingSuccess(false), 3000);
        fetch('/api/partnership/partners', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.partners) setPartners(data.partners); });
      }
    } catch {}
    setGivingSubmitting(false);
  }

  const fmtNGN = (n: number) => n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `₦${(n / 1000).toFixed(0)}k` : `₦${Math.round(n).toLocaleString()}`;

  const activePartners = partners.filter(p => p.status === 'active');
  const lapsedPartners = partners.filter(p => p.status === 'lapsed');
  const paidThisMonth = partners.filter(p => p.this_month_paid).length;
  const totalMonthly = activePartners.reduce((a, p) => a + p.band_amount, 0);
  const totalCollected = partners.reduce((a, p) => a + p.total_given, 0);

  const bandBreakdown = BAND_TIERS.map(b => ({
    name: b.name,
    count: activePartners.filter(p => p.band_name === b.name).length,
    total: activePartners.filter(p => p.band_name === b.name).reduce((a, p) => a + p.band_amount, 0),
    color: b.color,
    icon: b.icon,
    amount: b.amount,
  }));

  const filteredPartners = partners.filter(p => {
    const matchSearch = partnerSearch ? p.full_name.toLowerCase().includes(partnerSearch.toLowerCase()) : true;
    const matchBand = bandFilter !== 'all' ? p.band_name === bandFilter : true;
    return matchSearch && matchBand;
  });

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'partners', label: `Partners (${activePartners.length})` },
    { id: 'log', label: 'Log Giving' },
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
            <div style={{ fontSize: 10, color: t.muted }}>Partnership Admin{leaderName ? ` · ${leaderName}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell dark={dark} />
          <div onClick={() => setDark(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>
            {dark ? '☀' : '◑'}
          </div>
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

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Active partners', value: activePartners.length, sub: `${lapsedPartners.length} lapsed`, accent: '#534AB7' },
                { label: 'Monthly target', value: fmtNGN(totalMonthly), sub: 'If all active pay', accent: '#1D9E75' },
                { label: 'Paid this month', value: `${paidThisMonth}/${activePartners.length}`, sub: `${activePartners.length > 0 ? Math.round((paidThisMonth / activePartners.length) * 100) : 0}% collected`, accent: '#BA7517' },
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
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 14 }}>Partnership band breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {bandBreakdown.map(b => (
                  <div key={b.name} style={{ background: t.input, borderRadius: 10, padding: '14px', textAlign: 'center', border: `0.5px solid ${t.border}` }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{b.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: b.color, marginBottom: 4 }}>{b.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>{b.count}</div>
                    <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>partners</div>
                    <div style={{ fontSize: 11, color: t.sub, marginTop: 6 }}>₦{b.amount.toLocaleString()}/mo each</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: b.color, marginTop: 2 }}>{fmtNGN(b.total)}/mo total</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lapsed alerts */}
            {lapsedPartners.length > 0 && (
              <div style={{ background: t.coralBg, borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(216,90,48,0.2)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.coral, marginBottom: 8 }}>⚠ {lapsedPartners.length} lapsed partner{lapsedPartners.length > 1 ? 's' : ''} — follow up needed</div>
                {lapsedPartners.slice(0, 3).map(p => (
                  <div key={p.id} style={{ fontSize: 12, color: t.coral, opacity: 0.8 }}>{p.full_name} — {p.band_name}</div>
                ))}
                {lapsedPartners.length > 3 && <div style={{ fontSize: 11, color: t.coral, opacity: 0.6, marginTop: 4 }}>+{lapsedPartners.length - 3} more</div>}
              </div>
            )}
          </div>
        )}

        {/* PARTNERS */}
        {tab === 'partners' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={partnerSearch} onChange={e => setPartnerSearch(e.target.value)} placeholder="Search partners..."
                style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
              <select value={bandFilter} onChange={e => setBandFilter(e.target.value)}
                style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                <option value="all">All bands</option>
                {BAND_TIERS.map(b => <option key={b.name} value={b.name}>{b.icon} {b.name}</option>)}
              </select>
            </div>

            {/* Add new partner */}
            <div style={card()}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Add new partner</div>
              {partnerSuccess && <div style={{ background: t.tealBg, borderRadius: 8, padding: '9px 12px', marginBottom: 10, fontSize: 12, color: t.teal, fontWeight: 500 }}>Partner added successfully.</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Full name *</div>
                  <input value={newPartner.full_name} onChange={e => setNewPartner(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="First and last name"
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Band *</div>
                  <select value={newPartner.band_id} onChange={e => setNewPartner(p => ({ ...p, band_id: e.target.value }))}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                    <option value="">Select band</option>
                    {bands.map(b => <option key={b.id} value={b.id}>{b.name} — ₦{b.amount.toLocaleString()}/mo</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Phone</div>
                  <input value={newPartner.phone} onChange={e => setNewPartner(p => ({ ...p, phone: e.target.value }))}
                    placeholder="08012345678"
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Start date</div>
                  <input type="date" value={newPartner.start_date} onChange={e => setNewPartner(p => ({ ...p, start_date: e.target.value }))}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
                </div>
              </div>
              <button onClick={addPartner} disabled={addingPartner}
                style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', opacity: addingPartner ? 0.7 : 1 }}>
                {addingPartner ? 'Adding...' : 'Add partner'}
              </button>
            </div>

            {/* Partner list */}
            <div style={{ ...card({ padding: 0 }), overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                    {['Name', 'Band', 'Monthly', 'This month', 'Consistency', 'Total given', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < filteredPartners.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: t.text }}>{p.full_name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: t.input, color: t.text, fontWeight: 500 }}>{p.band_name}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: t.purple, fontWeight: 500 }}>₦{p.band_amount.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: p.this_month_paid ? t.tealBg : t.coralBg, color: p.this_month_paid ? t.teal : t.coral, fontWeight: 500 }}>
                          {p.this_month_paid ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: t.text }}>{p.months_consistent} mo</td>
                      <td style={{ padding: '10px 12px', color: t.teal, fontWeight: 500 }}>{fmtNGN(p.total_given)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: p.status === 'active' ? t.tealBg : t.coralBg, color: p.status === 'active' ? t.teal : t.coral, fontWeight: 500 }}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredPartners.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: t.muted, fontSize: 13 }}>No partners found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOG GIVING */}
        {tab === 'log' && (
          <div style={card()}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Log partnership giving</div>
            {givingSuccess && <div style={{ background: t.tealBg, borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: t.teal, fontWeight: 500 }}>Giving record saved.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Partner *</div>
                <select value={givingForm.partner_id} onChange={e => setGivingForm(p => ({ ...p, partner_id: e.target.value }))}
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                  <option value="">Select partner</option>
                  {partners.filter(p => p.status === 'active').map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} — {p.band_name} (₦{p.band_amount.toLocaleString()}/mo)</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Amount (₦) *</div>
                  <input type="number" value={givingForm.amount} onChange={e => setGivingForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
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
                  <option value="missed">Missed</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Notes</div>
                <input value={givingForm.notes} onChange={e => setGivingForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <button onClick={logGiving} disabled={givingSubmitting}
                style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: givingSubmitting ? 0.7 : 1 }}>
                {givingSubmitting ? 'Saving...' : 'Save giving record'}
              </button>
            </div>
          </div>
        )}

        {/* LAPSED */}
        {tab === 'lapsed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: t.sub, marginBottom: 4 }}>Partners who have missed 2+ consecutive months. Follow up to restore their commitment.</div>
            {lapsedPartners.length === 0 ? (
              <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 13, color: t.teal }}>No lapsed partners — excellent retention!</div>
              </div>
            ) : (
              lapsedPartners.map(p => (
                <div key={p.id} style={{ ...card({ padding: '14px 16px' }), borderLeft: `3px solid ${t.coral}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{p.full_name}</div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{p.band_name} · ₦{p.band_amount.toLocaleString()}/mo · {p.phone}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: t.coral, fontWeight: 500 }}>Lapsed</div>
                      <div style={{ fontSize: 11, color: t.muted }}>{p.months_consistent} months consistent before</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
