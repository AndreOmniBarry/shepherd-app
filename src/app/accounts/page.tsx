'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type IncomeType = { id: string; name: string; category: string };
type IncomeRecord = { id: string; income_type_name: string; member_name: string; amount: number; service_date: string; notes: string };
type ExpenseCategory = { id: string; name: string };
type Requisition = { id: string; title: string; category_name: string; amount_requested: number; amount_approved: number | null; requested_by_name: string; status: string; created_at: string };

type NavTab = 'overview' | 'income' | 'expenses' | 'requisitions';

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  pending:  { bg: '#FAEEDA', text: '#633806' },
  approved: { bg: '#E1F5EE', text: '#085041' },
  rejected: { bg: '#FAECE7', text: '#993C1D' },
  paid:     { bg: '#EEEDFE', text: '#3C3489' },
};

const INCOME_COLORS = ['#534AB7','#1D9E75','#BA7517','#D85A30','#9C27B0','#00BCD4','#E91E63'];

export default function AccountsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<NavTab>('overview');
  const [dark, setDark] = useState(false);
  const [leaderName, setLeaderName] = useState('');
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);

  // Income form
  const [incomeForm, setIncomeForm] = useState({ income_type_id: '', member_name: '', amount: '', service_date: new Date().toISOString().split('T')[0], notes: '' });
  const [incomeSubmitting, setIncomeSubmitting] = useState(false);
  const [incomeSuccess, setIncomeSuccess] = useState(false);

  // Expense form
  const [expenseForm, setExpenseForm] = useState({ category_id: '', title: '', description: '', amount_requested: '', requested_by_name: leaderName, department_id: '' });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState(false);

  // New type/category forms
  const [newIncomeType, setNewIncomeType] = useState('');
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
    chartGrid: dark ? '#2A2A2A' : '#F0F0F0', chartAxis: dark ? '#888' : '#6B7280',
  };

  const card = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px', ...e });

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
  }, [router]);

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  async function submitIncome() {
    if (!incomeForm.income_type_id || !incomeForm.amount) return;
    setIncomeSubmitting(true);
    try {
      const res = await fetch('/api/accounts/income', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(incomeForm),
      });
      if (res.ok) {
        setIncomeSuccess(true);
        setIncomeForm({ income_type_id: '', member_name: '', amount: '', service_date: new Date().toISOString().split('T')[0], notes: '' });
        setTimeout(() => setIncomeSuccess(false), 3000);
        // Refresh income records
        fetch('/api/accounts/income', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.records) setIncomeRecords(data.records); });
      }
    } catch {}
    setIncomeSubmitting(false);
  }

  async function submitExpense() {
    if (!expenseForm.title || !expenseForm.amount_requested) return;
    setExpenseSubmitting(true);
    try {
      const res = await fetch('/api/accounts/requisitions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...expenseForm, requested_by_name: leaderName }),
      });
      if (res.ok) {
        setExpenseSuccess(true);
        setExpenseForm({ category_id: '', title: '', description: '', amount_requested: '', requested_by_name: '', department_id: '' });
        setTimeout(() => setExpenseSuccess(false), 3000);
        fetch('/api/accounts/requisitions', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.requisitions) setRequisitions(data.requisitions); });
      }
    } catch {}
    setExpenseSubmitting(false);
  }

  async function approveRequisition(id: string, approve: boolean) {
    await fetch(`/api/accounts/requisitions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status: approve ? 'approved' : 'rejected' }),
    });
    fetch('/api/accounts/requisitions', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.requisitions) setRequisitions(data.requisitions); });
  }

  const fmtNGN = (n: number) => n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `₦${(n / 1000).toFixed(0)}k` : `₦${Math.round(n).toLocaleString()}`;

  const totalIncome = incomeRecords.reduce((a, r) => a + r.amount, 0);
  const totalApproved = requisitions.filter(r => r.status === 'approved' || r.status === 'paid').reduce((a, r) => a + (r.amount_approved || r.amount_requested), 0);
  const pendingReqs = requisitions.filter(r => r.status === 'pending').length;

  // Income by type for pie chart
  const incomeByType = incomeTypes.map(t => ({
    name: t.name,
    value: incomeRecords.filter(r => r.income_type_name === t.name).reduce((a, r) => a + r.amount, 0),
  })).filter(t => t.value > 0);

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'income', label: 'Log Income' },
    { id: 'expenses', label: 'Expenses' },
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
                { label: 'Total income', value: fmtNGN(totalIncome), sub: 'All records', accent: '#1D9E75' },
                { label: 'Total expenses', value: fmtNGN(totalApproved), sub: 'Approved only', accent: '#D85A30' },
                { label: 'Net balance', value: fmtNGN(totalIncome - totalApproved), sub: 'Income minus expenses', accent: '#534AB7' },
                { label: 'Pending requests', value: pendingReqs, sub: 'Awaiting approval', accent: '#BA7517' },
              ].map(k => (
                <div key={k.label} style={{ ...card({ padding: '12px 14px' }), borderTop: `2.5px solid ${k.accent}` }}>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: t.muted, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Income by type pie */}
            {incomeByType.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={card()}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Income breakdown</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={incomeByType} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                        {incomeByType.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtNGN(v)} contentStyle={{ fontSize: 11, borderRadius: 8, background: t.card, color: t.text }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {incomeByType.map((item, i) => (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: t.sub }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: INCOME_COLORS[i % INCOME_COLORS.length], flexShrink: 0 }} />
                        {item.name}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={card()}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Recent income</div>
                  {incomeRecords.slice(0, 6).map((r, i) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 5 ? `0.5px solid ${t.border}` : 'none', fontSize: 12 }}>
                      <div>
                        <div style={{ color: t.text, fontWeight: 500 }}>{r.income_type_name}</div>
                        <div style={{ fontSize: 10, color: t.muted }}>{r.member_name || 'Aggregate'} · {new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                      </div>
                      <div style={{ color: t.teal, fontWeight: 600 }}>{fmtNGN(r.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incomeByType.length === 0 && (
              <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 13, color: t.sub, marginBottom: 8 }}>No income records yet</div>
                <div style={{ fontSize: 11, color: t.muted }}>Use the Log Income tab to start recording</div>
              </div>
            )}
          </div>
        )}

        {/* INCOME */}
        {tab === 'income' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Log income record</div>
              {incomeSuccess && <div style={{ background: t.tealBg, borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: t.teal, fontWeight: 500 }}>Income record saved.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Income type *</div>
                    <select value={incomeForm.income_type_id} onChange={e => setIncomeForm(p => ({ ...p, income_type_id: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                      <option value="">Select type</option>
                      {incomeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Amount (₦) *</div>
                    <input type="number" value={incomeForm.amount} onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Member name (if individual)</div>
                    <input value={incomeForm.member_name} onChange={e => setIncomeForm(p => ({ ...p, member_name: e.target.value }))}
                      placeholder="Leave blank for aggregate" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Service date *</div>
                    <input type="date" value={incomeForm.service_date} onChange={e => setIncomeForm(p => ({ ...p, service_date: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Notes</div>
                  <input value={incomeForm.notes} onChange={e => setIncomeForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional notes" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <button onClick={submitIncome} disabled={incomeSubmitting}
                  style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: incomeSubmitting ? 0.7 : 1 }}>
                  {incomeSubmitting ? 'Saving...' : 'Save income record'}
                </button>
              </div>
            </div>

            {/* Add new income type */}
            <div style={card()}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 10 }}>Add new income type</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newIncomeType} onChange={e => setNewIncomeType(e.target.value)}
                  placeholder="e.g. Harvest Offering, Convention Seed..."
                  style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={async () => {
                  if (!newIncomeType.trim()) return;
                  await fetch('/api/accounts/income-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: newIncomeType }) });
                  setNewIncomeType('');
                  fetch('/api/accounts/income-types', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.types) setIncomeTypes(data.types); });
                }}
                  style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EXPENSES */}
        {tab === 'expenses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Log expense</div>
              {expenseSuccess && <div style={{ background: t.tealBg, borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: t.teal, fontWeight: 500 }}>Expense logged successfully.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Category</div>
                    <select value={expenseForm.category_id} onChange={e => setExpenseForm(p => ({ ...p, category_id: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                      <option value="">Select category</option>
                      {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Amount requested (₦) *</div>
                    <input type="number" value={expenseForm.amount_requested} onChange={e => setExpenseForm(p => ({ ...p, amount_requested: e.target.value }))}
                      placeholder="0" style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Title / purpose *</div>
                  <input value={expenseForm.title} onChange={e => setExpenseForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Sound system maintenance, March salaries..."
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Description / justification</div>
                  <textarea value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Provide context for this expense request..." rows={3}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                </div>
                <button onClick={submitExpense} disabled={expenseSubmitting}
                  style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: expenseSubmitting ? 0.7 : 1 }}>
                  {expenseSubmitting ? 'Submitting...' : 'Submit expense request'}
                </button>
              </div>
            </div>

            {/* Add new expense category */}
            <div style={card()}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 10 }}>Add new expense category</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newExpenseCategory} onChange={e => setNewExpenseCategory(e.target.value)}
                  placeholder="e.g. Building fund, Guest minister honorarium..."
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

        {/* REQUISITIONS */}
        {tab === 'requisitions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: t.sub, marginBottom: 4 }}>All expense requests — approve, reject, or mark as paid.</div>
            {requisitions.length === 0 ? (
              <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 13, color: t.muted }}>No expense requests yet.</div>
              </div>
            ) : (
              requisitions.map(r => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending;
                return (
                  <div key={r.id} style={card({ padding: '14px 16px' })}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{r.category_name} · {r.requested_by_name} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: cfg.bg, color: cfg.text, fontWeight: 500, flexShrink: 0 }}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>₦{r.amount_requested.toLocaleString()}</div>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => approveRequisition(r.id, true)}
                            style={{ background: t.tealBg, color: t.teal, border: 'none', borderRadius: 7, padding: '6px 13px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                            Approve
                          </button>
                          <button onClick={() => approveRequisition(r.id, false)}
                            style={{ background: t.coralBg, color: t.coral, border: 'none', borderRadius: 7, padding: '6px 13px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                            Reject
                          </button>
                        </div>
                      )}
                      {r.status === 'approved' && (
                        <button onClick={async () => { await fetch(`/api/accounts/requisitions/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ status: 'paid' }) }); fetch('/api/accounts/requisitions', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (data?.requisitions) setRequisitions(data.requisitions); }); }}
                          style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 7, padding: '6px 13px', fontSize: 11, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                          Mark paid
                        </button>
                      )}
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
