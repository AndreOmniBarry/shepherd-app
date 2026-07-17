'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type Member = { id: string; full_name: string; phone: string | null };
type IncomeType = { id: string; name: string; category: string };
type IncomeRecord = { id: string; income_type_name: string; member_name: string | null; amount: number; service_date: string; notes: string | null };
type ExpenseCategory = { id: string; name: string };
type Requisition = {
  id: string; title: string; category_name: string;
  amount_requested: number; amount_approved: number | null;
  requested_by_name: string; status: string; created_at: string; notes: string | null;
};

type NavTab = 'overview' | 'income' | 'expenses' | 'requisitions';

const MONTHS_2026 = [
  { value: '2026-01-01', label: 'January 2026' },
  { value: '2026-02-01', label: 'February 2026' },
  { value: '2026-03-01', label: 'March 2026' },
  { value: '2026-04-01', label: 'April 2026' },
  { value: '2026-05-01', label: 'May 2026' },
  { value: '2026-06-01', label: 'June 2026' },
  { value: '2026-07-01', label: 'July 2026' },
];

const INCOME_COLORS = ['#534AB7','#1D9E75','#BA7517','#D85A30','#9C27B0','#00BCD4','#E91E63'];

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: '#FAEEDA', text: '#633806', label: 'Pending approval' },
  approved: { bg: '#E1F5EE', text: '#085041', label: 'Approved' },
  rejected: { bg: '#FAECE7', text: '#993C1D', label: 'Rejected' },
  paid:     { bg: '#EEEDFE', text: '#3C3489', label: 'Paid' },
};

const EXPENSE_DESCRIPTIONS: Record<string, string> = {
  'Salaries & Stipends': 'Monthly payments to staff, ministers, and workers',
  'Utilities': 'Electricity, water, and internet bills',
  'Maintenance': 'Building repairs, AC servicing, generator maintenance',
  'Events & Programs': 'Crusades, conferences, special programmes, anniversary',
  'Stationery & Supplies': 'Paper, pens, printing, offering envelopes, flyers',
  'Transportation': 'Fuel, diesel, vehicle maintenance, travel costs',
  'Media & Technology': 'Equipment purchase, cameras, sound, streaming',
  'Welfare & Benevolence': 'Member welfare, benevolence fund, hospital bills',
  'Miscellaneous': 'One-off expenses that do not fit other categories',
};

export default function AccountsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<NavTab>('overview');
  const [dark, setDark] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart member search
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const memberRef = useRef<HTMLDivElement>(null);

  // Income form
  const [incomeForm, setIncomeForm] = useState({
    income_type_id: '', amount: '', service_date: new Date().toISOString().split('T')[0],
    notes: '', is_backdated: false, backdate_month: MONTHS_2026[0].value,
  });
  const [incomeSubmitting, setIncomeSubmitting] = useState(false);
  const [incomeSuccess, setIncomeSuccess] = useState(false);
  const [incomeError, setIncomeError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [newIncomeType, setNewIncomeType] = useState('');

  // Expense form
  const [expenseForm, setExpenseForm] = useState({
    category_id: '', title: '', description: '', amount_requested: '',
  });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState(false);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');

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

  const card = (e?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px', ...e,
  });

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (!data) { router.push('/login'); return; } setLeaderName(data.name || ''); })
      .catch(() => router.push('/login'));

    Promise.all([
      fetch('/api/accounts/income-types', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/accounts/income', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/accounts/expense-categories', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/accounts/requisitions', { credentials: 'include' }).then(r => r.json()),
    ]).then(([typesRes, incomeRes, catRes, reqRes]) => {
      if (typesRes.data?.types) setIncomeTypes(typesRes.data.types);
      if (incomeRes.data?.records) setIncomeRecords(incomeRes.data.records);
      if (catRes.data?.categories) setExpenseCategories(catRes.data.categories);
      if (reqRes.data?.requisitions) setRequisitions(reqRes.data.requisitions);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Load all members for smart search
    fetch('/api/members/search?q=', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.members) setMembers(data.members); })
      .catch(() => {});
  }, [router]);

  // Smart member search
  useEffect(() => {
    if (memberSearch.length < 2) { setMemberResults([]); return; }
    const results = members.filter(m =>
      m.full_name.toLowerCase().includes(memberSearch.toLowerCase())
    ).slice(0, 8);
    setMemberResults(results);
    setShowMemberDropdown(results.length > 0);
  }, [memberSearch, members]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Check for duplicate tithe entry
  async function checkDuplicate() {
    if (!selectedMember || !incomeForm.income_type_id) return;
    const incomeType = incomeTypes.find(t => t.id === incomeForm.income_type_id);
    if (incomeType?.category !== 'individual') return;

    const dateToCheck = incomeForm.is_backdated ? incomeForm.backdate_month : incomeForm.service_date;
    const monthStr = dateToCheck.slice(0, 7);

    const existing = incomeRecords.filter(r =>
      r.member_name === selectedMember.full_name &&
      r.income_type_name === incomeType.name &&
      r.service_date.startsWith(monthStr)
    );
    if (existing.length > 0) {
      setDuplicateWarning(`⚠ A ${incomeType.name} record for ${selectedMember.full_name} already exists for ${monthStr}. Are you sure you want to add another?`);
    } else {
      setDuplicateWarning('');
    }
  }

  useEffect(() => { checkDuplicate(); }, [selectedMember, incomeForm.income_type_id, incomeForm.service_date, incomeForm.backdate_month]);

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  async function submitIncome() {
    if (!incomeForm.income_type_id || !incomeForm.amount) { setIncomeError('Income type and amount are required'); return; }
    setIncomeSubmitting(true);
    setIncomeError('');
    try {
      const serviceDate = incomeForm.is_backdated ? incomeForm.backdate_month : incomeForm.service_date;
      const res = await fetch('/api/accounts/income', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          income_type_id: incomeForm.income_type_id,
          member_name: selectedMember?.full_name || null,
          member_id: selectedMember?.id || null,
          amount: parseFloat(incomeForm.amount),
          service_date: serviceDate,
          notes: incomeForm.notes || null,
        }),
      });
      if (res.ok) {
        setIncomeSuccess(true);
        setIncomeForm({ income_type_id: '', amount: '', service_date: new Date().toISOString().split('T')[0], notes: '', is_backdated: false, backdate_month: MONTHS_2026[0].value });
        setSelectedMember(null);
        setMemberSearch('');
        setDuplicateWarning('');
        setTimeout(() => setIncomeSuccess(false), 3000);
        Promise.all([
          fetch('/api/accounts/income', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/accounts/income-types', { credentials: 'include' }).then(r => r.json()),
        ]).then(([incomeRes, typesRes]) => {
          if (incomeRes.data?.records) setIncomeRecords(incomeRes.data.records);
          if (typesRes.data?.types) setIncomeTypes(typesRes.data.types);
        });
        setTab('overview');
      } else {
        const json = await res.json();
        setIncomeError(json.error?.message || 'Failed to save');
      }
    } catch { setIncomeError('Network error'); }
    setIncomeSubmitting(false);
  }

  async function submitExpense() {
    if (!expenseForm.title || !expenseForm.amount_requested) { return; }
    setExpenseSubmitting(true);
    try {
      const res = await fetch('/api/accounts/requisitions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...expenseForm, requested_by_name: leaderName }),
      });
      if (res.ok) {
        setExpenseSuccess(true);
        setExpenseForm({ category_id: '', title: '', description: '', amount_requested: '' });
        setTimeout(() => setExpenseSuccess(false), 3000);
        fetch('/api/accounts/requisitions', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.requisitions) setRequisitions(data.requisitions); });
      }
    } catch {}
    setExpenseSubmitting(false);
  }

  async function updateRequisition(id: string, status: string) {
    await fetch(`/api/accounts/requisitions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status }),
    });
    fetch('/api/accounts/requisitions', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.requisitions) setRequisitions(data.requisitions); });
  }

  const fmtNGN = (n: number) => n >= 1e9 ? `₦${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `₦${(n / 1e6).toFixed(2)}M` : `₦${Math.round(n).toLocaleString('en-NG')}`;
  const totalIncome = incomeRecords.reduce((a, r) => a + r.amount, 0);
  const totalApproved = requisitions.filter(r => ['approved','paid'].includes(r.status)).reduce((a, r) => a + (r.amount_approved || r.amount_requested), 0);
  const pendingReqs = requisitions.filter(r => r.status === 'pending').length;
  const incomeByType = incomeTypes.map(t => ({
    name: t.name,
    value: incomeRecords.filter(r => r.income_type_name === t.name).reduce((a, r) => a + r.amount, 0),
  })).filter(t => t.value > 0);

  const selectedIncomeType = incomeTypes.find(t => t.id === incomeForm.income_type_id);
  const isIndividualType = selectedIncomeType?.category === 'individual' || selectedIncomeType?.category === 'partnership';
  const isAggregateType = selectedIncomeType?.category === 'aggregate';

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'income', label: 'Log income' },
    { id: 'expenses', label: 'Log expense' },
    { id: 'requisitions', label: `Requisitions${pendingReqs > 0 ? ` (${pendingReqs})` : ''}` },
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
            <div style={{ fontSize: 10, color: t.muted }}>Accounts{leaderName ? ` · ${leaderName}` : ''}</div>
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

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: 'Total income', value: fmtNGN(totalIncome), sub: `${incomeRecords.length} entries`, accent: '#1D9E75' },
                { label: 'Total expenses', value: fmtNGN(totalApproved), sub: 'Approved only', accent: '#D85A30' },
                { label: 'Net balance', value: fmtNGN(totalIncome - totalApproved), sub: 'Income minus expenses', accent: totalIncome - totalApproved >= 0 ? '#534AB7' : '#D85A30' },
                { label: 'Pending requests', value: pendingReqs, sub: 'Awaiting approval', accent: '#BA7517' },
              ].map(k => (
                <div key={k.label} style={{ ...card({ padding: '12px 14px' }), borderTop: `2.5px solid ${k.accent}` }}>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {incomeByType.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={card()}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Income by type</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={incomeByType} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                        {incomeByType.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtNGN(v)} contentStyle={{ fontSize: 11, borderRadius: 8, background: t.card, color: t.text }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {incomeByType.map((item, i) => (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: t.sub }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: INCOME_COLORS[i % INCOME_COLORS.length], flexShrink: 0 }} />
                        {item.name} — {fmtNGN(item.value)}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={card()}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Recent entries</div>
                  {incomeRecords.slice(0, 7).map((r, i) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 6 ? `0.5px solid ${t.border}` : 'none', fontSize: 12 }}>
                      <div>
                        <div style={{ color: t.text, fontWeight: 500 }}>{r.income_type_name}</div>
                        <div style={{ fontSize: 10, color: t.muted }}>{r.member_name || 'Aggregate'} · {new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                      </div>
                      <div style={{ color: t.teal, fontWeight: 600 }}>{fmtNGN(r.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 13, color: t.sub, marginBottom: 6 }}>No income records yet</div>
                <div style={{ fontSize: 11, color: t.muted }}>Use Log income to start recording</div>
              </div>
            )}
          </div>
        )}

        {/* ── LOG INCOME ── */}
        {tab === 'income' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Log income entry</div>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 16, lineHeight: 1.5 }}>
                For tithe and individual giving, search and select the member first. For offerings, miracle seeds, and aggregate types, leave member blank.
                Toggle backdating to log historical entries from January 2026 onwards.
              </div>

              {incomeSuccess && <div style={{ background: t.tealBg, borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: t.teal, fontWeight: 500 }}>Entry saved successfully.</div>}
              {incomeError && <div style={{ background: t.coralBg, borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: t.coral }}>{incomeError}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Income type */}
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Income type *</div>
                  <select value={incomeForm.income_type_id} onChange={e => setIncomeForm(p => ({ ...p, income_type_id: e.target.value }))}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                    <option value="">Select income type</option>
                    {incomeTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                  {selectedIncomeType && (
                    <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>
                      {isIndividualType ? '● Individual — select the member below' : isAggregateType ? '● Aggregate — no member selection needed' : ''}
                    </div>
                  )}
                </div>

                {/* Smart member search — only for individual types */}
                {isIndividualType && (
                  <div ref={memberRef} style={{ position: 'relative' }}>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>
                      Member {isIndividualType ? '*' : '(optional)'}
                    </div>
                    {selectedMember ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.tealBg, borderRadius: 8, padding: '9px 12px', border: `0.5px solid rgba(29,158,117,0.2)` }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.teal }}>{selectedMember.full_name}</div>
                          {selectedMember.phone && <div style={{ fontSize: 10, color: t.muted }}>{selectedMember.phone}</div>}
                        </div>
                        <button onClick={() => { setSelectedMember(null); setMemberSearch(''); setDuplicateWarning(''); }}
                          style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>×</button>
                      </div>
                    ) : (
                      <input
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        onFocus={() => memberSearch.length >= 2 && setShowMemberDropdown(true)}
                        placeholder="Type at least 2 letters to search members..."
                        style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }}
                      />
                    )}
                    {showMemberDropdown && memberResults.length > 0 && !selectedMember && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 9, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden', marginTop: 4 }}>
                        {memberResults.map(m => (
                          <div key={m.id} onClick={() => { setSelectedMember(m); setMemberSearch(''); setShowMemberDropdown(false); }}
                            style={{ padding: '10px 13px', cursor: 'pointer', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.background = t.input)}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{m.full_name}</div>
                            {m.phone && <div style={{ fontSize: 10, color: t.muted }}>{m.phone}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Duplicate warning */}
                {duplicateWarning && (
                  <div style={{ background: t.amberBg, borderRadius: 8, padding: '10px 13px', fontSize: 12, color: t.amber, border: `0.5px solid rgba(186,117,23,0.2)` }}>
                    {duplicateWarning}
                  </div>
                )}

                {/* Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Amount (₦) *</div>
                    <input type="text" inputMode="numeric" value={incomeForm.amount ? Number(String(incomeForm.amount).replace(/,/g,'')).toLocaleString('en-NG') : ''} onChange={e => { const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''); setIncomeForm(p => ({ ...p, amount: raw })); }}
                      placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: 600, background: t.input, color: t.teal, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>
                      {incomeForm.is_backdated ? 'Historical month' : 'Service date'} *
                    </div>
                    {incomeForm.is_backdated ? (
                      <select value={incomeForm.backdate_month} onChange={e => setIncomeForm(p => ({ ...p, backdate_month: e.target.value }))}
                        style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                        {MONTHS_2026.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    ) : (
                      <input type="date" value={incomeForm.service_date} onChange={e => setIncomeForm(p => ({ ...p, service_date: e.target.value }))}
                        style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
                    )}
                  </div>
                </div>

                {/* Backdating toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="backdate" checked={incomeForm.is_backdated} onChange={e => setIncomeForm(p => ({ ...p, is_backdated: e.target.checked }))} style={{ cursor: 'pointer' }} />
                  <label htmlFor="backdate" style={{ fontSize: 12, color: t.sub, cursor: 'pointer' }}>
                    This is a historical entry (backdating from January 2026)
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Notes (optional)</div>
                  <input value={incomeForm.notes} onChange={e => setIncomeForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="e.g. Transfer from Bro Emeka, included special seed..."
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                </div>

                <button onClick={submitIncome} disabled={incomeSubmitting}
                  style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: incomeSubmitting ? 0.7 : 1 }}>
                  {incomeSubmitting ? 'Saving...' : 'Save income entry'}
                </button>
              </div>
            </div>

            {/* Add new income type */}
            <div style={card()}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 10 }}>Add new income type</div>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 10 }}>Use this if a new type of income comes up that is not in the list above.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newIncomeType} onChange={e => setNewIncomeType(e.target.value)}
                  placeholder="e.g. Harvest Offering, Convention Seed..."
                  style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={async () => {
                  if (!newIncomeType.trim()) return;
                  const addRes = await fetch('/api/accounts/income-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: newIncomeType.trim(), category: 'aggregate', is_active: true }) });
                  const addData = await addRes.json();
                  setNewIncomeType('');
                  // Refresh types list and auto-select new type
                  const refreshRes = await fetch('/api/accounts/income-types', { credentials: 'include' });
                  const refreshData = await refreshRes.json();
                  if (refreshData.data?.types) {
                    setIncomeTypes(refreshData.data.types);
                    // Try to find by name since id may be nested differently
                    const typeName = newIncomeType.trim().toLowerCase();
                    const newType = refreshData.data.types.find((t: {id:string;name:string}) => t.name.toLowerCase() === typeName);
                    if (newType) setIncomeForm(p => ({ ...p, income_type_id: newType.id }));
                  }
                }}
                  style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                  Add type
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LOG EXPENSE ── */}
        {tab === 'expenses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Log expense request</div>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 16, lineHeight: 1.5 }}>
                Submit an expense request. It goes to the Church Admin for endorsement, then to the PA who nudges the Pastor for final approval. You will see the status update here.
              </div>

              {expenseSuccess && <div style={{ background: t.tealBg, borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: t.teal, fontWeight: 500 }}>Expense request submitted. Pending approval.</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Category</div>
                  <select value={expenseForm.category_id} onChange={e => setExpenseForm(p => ({ ...p, category_id: e.target.value }))}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                    <option value="">Select category</option>
                    {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {expenseForm.category_id && expenseCategories.find(c => c.id === expenseForm.category_id) && (
                    <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>
                      {EXPENSE_DESCRIPTIONS[expenseCategories.find(c => c.id === expenseForm.category_id)!.name] || ''}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Title / purpose *</div>
                    <input value={expenseForm.title} onChange={e => setExpenseForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Generator diesel — July, Sound system repair..."
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Amount requested (₦) *</div>
                    <input type="text" inputMode="numeric" value={expenseForm.amount_requested ? Number(String(expenseForm.amount_requested).replace(/,/g,'')).toLocaleString('en-NG') : ''} onChange={e => { const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, ''); setExpenseForm(p => ({ ...p, amount_requested: raw })); }}
                      placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, fontWeight: 600, background: t.input, color: t.coral, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Justification / description</div>
                  <textarea value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Explain why this expense is needed and what it covers..."
                    rows={3} style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                </div>

                <button onClick={submitExpense} disabled={expenseSubmitting || !expenseForm.title || !expenseForm.amount_requested}
                  style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: expenseSubmitting || !expenseForm.title || !expenseForm.amount_requested ? 0.6 : 1 }}>
                  {expenseSubmitting ? 'Submitting...' : 'Submit expense request'}
                </button>
              </div>
            </div>

            {/* Add new category */}
            <div style={card()}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 10 }}>Add new expense category</div>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 10 }}>For one-off or new expense types not in the list above — e.g. Building fund, Guest minister honorarium.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newExpenseCategory} onChange={e => setNewExpenseCategory(e.target.value)}
                  placeholder="Category name..."
                  style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={async () => {
                  if (!newExpenseCategory.trim()) return;
                  await fetch('/api/accounts/expense-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: newExpenseCategory }) });
                  setNewExpenseCategory('');
                  fetch('/api/accounts/expense-categories', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.categories) setExpenseCategories(data.categories); });
                }}
                  style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── REQUISITIONS ── */}
        {tab === 'requisitions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: t.sub, marginBottom: 4, lineHeight: 1.6 }}>
              These are expense requests submitted by staff. As accounts admin, you can endorse or reject them. Endorsed requests go to the PA who takes them to the Pastor for final approval. Once the Pastor approves, you mark them as paid when money is disbursed.
            </div>

            {/* Status summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 6 }}>
              {[
                { label: 'Pending', count: requisitions.filter(r => r.status === 'pending').length, color: '#BA7517', bg: '#FAEEDA' },
                { label: 'Approved', count: requisitions.filter(r => r.status === 'approved').length, color: '#1D9E75', bg: '#E1F5EE' },
                { label: 'Paid', count: requisitions.filter(r => r.status === 'paid').length, color: '#534AB7', bg: '#EEEDFE' },
                { label: 'Rejected', count: requisitions.filter(r => r.status === 'rejected').length, color: '#D85A30', bg: '#FAECE7' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 9, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 10, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {requisitions.length === 0 ? (
              <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 13, color: t.muted }}>No expense requests yet.</div>
              </div>
            ) : (
              requisitions.map(r => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending;
                return (
                  <div key={r.id} style={{ ...card({ padding: '14px 16px' }), borderLeft: `3px solid ${r.status === 'pending' ? '#BA7517' : r.status === 'approved' ? '#1D9E75' : r.status === 'paid' ? '#534AB7' : '#D85A30'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: t.muted }}>
                          {r.category_name} · Requested by {r.requested_by_name} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: cfg.bg, color: cfg.text, fontWeight: 500, flexShrink: 0, marginLeft: 10 }}>{cfg.label}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>₦{r.amount_requested.toLocaleString()}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {r.status === 'pending' && (
                          <>
                            <button onClick={() => updateRequisition(r.id, 'approved')}
                              style={{ background: t.tealBg, color: t.teal, border: 'none', borderRadius: 7, padding: '6px 13px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                              Endorse
                            </button>
                            <button onClick={() => updateRequisition(r.id, 'rejected')}
                              style={{ background: t.coralBg, color: t.coral, border: 'none', borderRadius: 7, padding: '6px 13px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <button onClick={() => updateRequisition(r.id, 'paid')}
                            style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 7, padding: '6px 13px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                            Mark as paid
                          </button>
                        )}
                      </div>
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
