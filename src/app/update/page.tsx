'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';

type Member = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  cell_name?: string;
};

type MonthlyRecord = {
  member_id: string;
  month: string;
  times_present: number;
  times_absent: number;
  total_services: number;
  exit_type: string;
  exit_date: string;
  notes: string;
};

type EditState = {
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
};

const MONTHS = [
  { value: '2026-01-01', label: 'January 2026', sundays: 4 },
  { value: '2026-02-01', label: 'February 2026', sundays: 4 },
  { value: '2026-03-01', label: 'March 2026', sundays: 5 },
  { value: '2026-04-01', label: 'April 2026', sundays: 4 },
  { value: '2026-05-01', label: 'May 2026', sundays: 5 },
  { value: '2026-06-01', label: 'June 2026', sundays: 4 },
];

type Tab = 'profiles' | 'add_member' | 'attendance';

export default function UpdatePage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<Tab>('profiles');
  const [members, setMembers] = useState<Member[]>([]);
  const [editing, setEditing] = useState<Record<string, EditState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [leaderName, setLeaderName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete'>('incomplete');

  // Add member form
  const [newMember, setNewMember] = useState({ full_name: '', phone: '', email: '', date_of_birth: '', gender: '', join_date: new Date().toISOString().split('T')[0] });
  const [addingMember, setAddingMember] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [addError, setAddError] = useState('');
  const [pendingAdditions, setPendingAdditions] = useState<{ id: string; full_name: string; status: string; created_at: string }[]>([]);

  // Attendance backdating
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, MonthlyRecord>>({});
  const [existingRecords, setExistingRecords] = useState<MonthlyRecord[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(false);

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

    fetch('/api/update/members', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.members) {
          setMembers(data.members);
          setUnitName(data.unit_name || '');
          const initEdit: Record<string, EditState> = {};
          data.members.forEach((m: Member) => {
            initEdit[m.id] = { full_name: m.full_name || '', phone: m.phone || '', email: m.email || '', date_of_birth: m.date_of_birth || '', gender: m.gender || '' };
          });
          setEditing(initEdit);
          // Init attendance records for all members
          const initAtt: Record<string, MonthlyRecord> = {};
          data.members.forEach((m: Member) => {
            initAtt[m.id] = { member_id: m.id, month: MONTHS[0].value, times_present: 0, times_absent: 0, total_services: 4, exit_type: 'none', exit_date: '', notes: '' };
          });
          setAttendanceRecords(initAtt);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/update/attendance', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.records) setExistingRecords(data.records); })
      .catch(() => {});

    fetch('/api/update/member-additions', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.additions) setPendingAdditions(data.additions); })
      .catch(() => {});
  }, [router]);

  // Update attendance record for selected month when month changes
  useEffect(() => {
    const monthSundays = MONTHS.find(m => m.value === selectedMonth)?.sundays || 4;
    const initAtt: Record<string, MonthlyRecord> = {};
    members.forEach(m => {
      // Check if existing record for this member/month
      const existing = existingRecords.find(r => r.member_id === m.id && r.month === selectedMonth);
      if (existing) {
        initAtt[m.id] = { ...existing };
      } else {
        initAtt[m.id] = { member_id: m.id, month: selectedMonth, times_present: 0, times_absent: 0, total_services: monthSundays, exit_type: 'none', exit_date: '', notes: '' };
      }
    });
    setAttendanceRecords(initAtt);
  }, [selectedMonth, members, existingRecords]);

  function isIncomplete(m: Member) {
    return !m.phone || !m.date_of_birth || !m.gender || !m.full_name.includes(' ');
  }

  async function saveMember(id: string) {
    const edit = editing[id];
    if (!edit) return;
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/update/members/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(edit),
      });
      if (res.ok) {
        setSaved(prev => ({ ...prev, [id]: true }));
        setMembers(prev => prev.map(m => m.id === id ? { ...m, ...edit } : m));
        setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 3000);
      }
    } catch {}
    setSaving(prev => ({ ...prev, [id]: false }));
  }

  async function addMember() {
    if (!newMember.full_name.trim()) { setAddError('Full name is required'); return; }
    setAddingMember(true);
    setAddError('');
    try {
      const res = await fetch('/api/update/member-additions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(newMember),
      });
      if (res.ok) {
        setAddSuccess(true);
        setNewMember({ full_name: '', phone: '', email: '', date_of_birth: '', gender: '', join_date: new Date().toISOString().split('T')[0] });
        setTimeout(() => setAddSuccess(false), 4000);
        // Refresh pending additions
        fetch('/api/update/member-additions', { credentials: 'include' })
          .then(r => r.json())
          .then(({ data }) => { if (data?.additions) setPendingAdditions(data.additions); });
      } else {
        const json = await res.json();
        setAddError(json.error?.message || 'Failed to add member');
      }
    } catch { setAddError('Network error'); }
    setAddingMember(false);
  }

  async function saveAttendance() {
    setSavingAttendance(true);
    try {
      const records = Object.values(attendanceRecords).map(r => ({
        ...r,
        month: selectedMonth,
        times_absent: (MONTHS.find(m => m.value === selectedMonth)?.sundays || 4) - r.times_present,
        total_services: MONTHS.find(m => m.value === selectedMonth)?.sundays || 4,
      }));
      const res = await fetch('/api/update/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ records }),
      });
      if (res.ok) {
        setAttendanceSaved(true);
        setTimeout(() => setAttendanceSaved(false), 3000);
        // Refresh existing records
        fetch('/api/update/attendance', { credentials: 'include' })
          .then(r => r.json())
          .then(({ data }) => { if (data?.records) setExistingRecords(data.records); });
      }
    } catch {}
    setSavingAttendance(false);
  }

  function updateAtt(memberId: string, field: keyof MonthlyRecord, value: string | number) {
    setAttendanceRecords(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }));
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  const filteredMembers = members.filter(m => {
    const matchSearch = search ? m.full_name.toLowerCase().includes(search.toLowerCase()) : true;
    const matchFilter = filter === 'incomplete' ? isIncomplete(m) : true;
    return matchSearch && matchFilter;
  });

  const incompleteCount = members.filter(isIncomplete).length;
  const completeCount = members.length - incompleteCount;
  const selectedMonthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || '';
  const selectedMonthSundays = MONTHS.find(m => m.value === selectedMonth)?.sundays || 4;

  // Check if a month has any saved records
  function monthHasRecords(monthValue: string) {
    return existingRecords.some(r => r.month === monthValue);
  }

  const navTabs = [
    { id: 'profiles' as Tab, label: 'Update profiles' },
    { id: 'add_member' as Tab, label: 'Add members' },
    { id: 'attendance' as Tab, label: 'Log past attendance' },
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
            <div style={{ fontSize: 10, color: t.muted }}>Member Records Update{unitName ? ` · ${unitName}` : ''}</div>
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
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', display: 'flex' }}>
        {navTabs.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            style={{ padding: '10px 16px', border: 'none', borderBottom: `2px solid ${tab === n.id ? t.purple : 'transparent'}`, background: 'transparent', fontSize: 12, fontWeight: tab === n.id ? 600 : 400, color: tab === n.id ? t.purple : t.muted, cursor: 'pointer', marginBottom: -0.5, whiteSpace: 'nowrap' }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── UPDATE PROFILES ── */}
        {tab === 'profiles' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Member profile housecleaning</div>
              <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>Update missing information for your members. Fields highlighted in red are required. This form closes in 14 days.</div>
            </div>

            {/* Progress */}
            <div style={{ ...card({ marginBottom: 16 }) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>Completion progress</span>
                <span style={{ fontSize: 12, color: t.purple, fontWeight: 600 }}>{completeCount}/{members.length} complete</span>
              </div>
              <div style={{ height: 6, background: t.input, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${members.length > 0 ? (completeCount / members.length) * 100 : 0}%`, background: '#534AB7', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 11, color: t.teal }}>{completeCount} complete</span>
                <span style={{ fontSize: 11, color: t.coral }}>{incompleteCount} need attention</span>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..."
                style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
              <div style={{ display: 'flex', background: t.input, borderRadius: 8, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
                {[{ id: 'incomplete', label: `Incomplete (${incompleteCount})` }, { id: 'all', label: `All (${members.length})` }].map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id as typeof filter)}
                    style={{ padding: '8px 14px', border: 'none', background: filter === f.id ? '#534AB7' : 'transparent', color: filter === f.id ? '#fff' : t.sub, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: filter === f.id ? 600 : 400 }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading members...</div>
            ) : filteredMembers.length === 0 ? (
              <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 13, color: t.sub }}>{filter === 'incomplete' ? 'All records are complete!' : 'No members found.'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredMembers.map(m => {
                  const edit = editing[m.id];
                  if (!edit) return null;
                  const incomplete = isIncomplete(m);
                  return (
                    <div key={m.id} style={{ ...card(), borderLeft: `3px solid ${incomplete ? t.coral : t.teal}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{m.full_name}</div>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: incomplete ? t.coralBg : t.tealBg, color: incomplete ? t.coral : t.teal, fontWeight: 500 }}>
                          {incomplete ? 'Incomplete' : 'Complete'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { key: 'full_name', label: 'Full name', placeholder: 'First and last name', required: true, warning: !edit.full_name.includes(' ') },
                          { key: 'phone', label: 'Phone number', placeholder: '08012345678', required: true, warning: !edit.phone },
                          { key: 'date_of_birth', label: 'Date of birth', placeholder: '', required: true, warning: !edit.date_of_birth, type: 'date' },
                          { key: 'email', label: 'Email (optional)', placeholder: 'member@email.com', required: false, warning: false },
                        ].map(f => (
                          <div key={f.key}>
                            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                              {f.label} {f.required && <span style={{ color: t.coral }}>*</span>}
                            </div>
                            <input
                              type={f.type || 'text'}
                              value={edit[f.key as keyof EditState]}
                              onChange={e => setEditing(prev => ({ ...prev, [m.id]: { ...prev[m.id], [f.key]: e.target.value } }))}
                              placeholder={f.placeholder}
                              style={{ width: '100%', border: `0.5px solid ${f.warning ? 'rgba(216,90,48,0.5)' : t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }}
                            />
                          </div>
                        ))}
                        <div>
                          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Gender <span style={{ color: t.coral }}>*</span></div>
                          <select value={edit.gender} onChange={e => setEditing(prev => ({ ...prev, [m.id]: { ...prev[m.id], gender: e.target.value } }))}
                            style={{ width: '100%', border: `0.5px solid ${!edit.gender ? 'rgba(216,90,48,0.5)' : t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => saveMember(m.id)} disabled={saving[m.id]}
                          style={{ background: saved[m.id] ? '#1D9E75' : '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
                          {saving[m.id] ? 'Saving...' : saved[m.id] ? '✓ Saved' : 'Save changes'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ADD MEMBERS ── */}
        {tab === 'add_member' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Add missing members</div>
              <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>Add members from your cell register who are not yet in the system. Each addition goes to the Church Admin for approval before appearing in the main roster.</div>
            </div>

            {addSuccess && (
              <div style={{ background: t.tealBg, borderRadius: 9, border: `0.5px solid rgba(29,158,117,0.2)`, padding: '10px 14px', fontSize: 12, color: t.teal, fontWeight: 500 }}>
                Member submitted for addition. The Church Admin will review and approve shortly.
              </div>
            )}

            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>New member details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { key: 'full_name', label: 'Full name', placeholder: 'First and last name', required: true },
                  { key: 'phone', label: 'Phone number', placeholder: '08012345678', required: false },
                  { key: 'date_of_birth', label: 'Date of birth', placeholder: '', required: false, type: 'date' },
                  { key: 'email', label: 'Email', placeholder: 'Optional', required: false },
                  { key: 'join_date', label: 'Date they joined the cell', placeholder: '', required: false, type: 'date' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                      {f.label} {f.required && <span style={{ color: t.coral }}>*</span>}
                    </div>
                    <input
                      type={f.type || 'text'}
                      value={newMember[f.key as keyof typeof newMember]}
                      onChange={e => setNewMember(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Gender</div>
                  <select value={newMember.gender} onChange={e => setNewMember(p => ({ ...p, gender: e.target.value }))}
                    style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              {addError && <div style={{ fontSize: 12, color: t.coral, marginBottom: 10 }}>{addError}</div>}
              <button onClick={addMember} disabled={addingMember || !newMember.full_name.trim()}
                style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', opacity: addingMember || !newMember.full_name.trim() ? 0.6 : 1 }}>
                {addingMember ? 'Submitting...' : 'Submit for approval'}
              </button>
            </div>

            {/* Pending additions */}
            {pendingAdditions.length > 0 && (
              <div style={card()}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 12 }}>Submitted members — pending approval</div>
                {pendingAdditions.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < pendingAdditions.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <div style={{ fontSize: 12, color: t.text }}>{a.full_name}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: a.status === 'approved' ? t.tealBg : a.status === 'rejected' ? t.coralBg : t.amberBg, color: a.status === 'approved' ? t.teal : a.status === 'rejected' ? t.coral : t.amber, fontWeight: 500 }}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ATTENDANCE BACKDATING ── */}
        {tab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Log past attendance</div>
              <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
                For each member, enter how many Sundays they attended in each month from your cell register. This will not trigger any absence alerts — it is purely for historical records and trend analysis.
              </div>
            </div>

            {/* Month selector */}
            <div style={card()}>
              <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Select month to log</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MONTHS.map(m => (
                  <button key={m.value} onClick={() => setSelectedMonth(m.value)}
                    style={{ padding: '7px 14px', borderRadius: 8, border: `0.5px solid ${selectedMonth === m.value ? '#534AB7' : t.border}`, background: selectedMonth === m.value ? '#534AB7' : t.input, color: selectedMonth === m.value ? '#fff' : t.sub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: selectedMonth === m.value ? 600 : 400, position: 'relative' }}>
                    {m.label}
                    {monthHasRecords(m.value) && (
                      <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', border: `2px solid ${t.card}` }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendance entry for selected month */}
            {members.length === 0 ? (
              <div style={{ ...card(), textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 13, color: t.sub }}>No members in your cell yet. Add members first using the Add Members tab.</div>
              </div>
            ) : (
              <div style={card()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{selectedMonthLabel}</div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{selectedMonthSundays} Sundays in this month · tap the number to edit</div>
                  </div>
                  {attendanceSaved && <span style={{ fontSize: 11, color: t.teal, fontWeight: 500 }}>✓ Saved</span>}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                        {['Member', `Sundays present (of ${selectedMonthSundays})`, 'Status in this month', 'Exit date (if applicable)', 'Notes'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', background: t.card }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m, i) => {
                        const rec = attendanceRecords[m.id];
                        if (!rec) return null;
                        const rate = selectedMonthSundays > 0 ? Math.round((rec.times_present / selectedMonthSundays) * 100) : 0;
                        return (
                          <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                            <td style={{ padding: '10px 10px', fontWeight: 500, color: t.text, whiteSpace: 'nowrap' }}>{m.full_name}</td>
                            <td style={{ padding: '10px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={selectedMonthSundays}
                                  value={rec.times_present}
                                  onChange={e => {
                                    const val = Math.min(selectedMonthSundays, Math.max(0, parseInt(e.target.value) || 0));
                                    updateAtt(m.id, 'times_present', val);
                                  }}
                                  style={{ width: 60, border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 13, fontWeight: 600, background: t.input, color: rate >= 75 ? t.teal : rate >= 50 ? t.amber : t.coral, outline: 'none', textAlign: 'center' }}
                                />
                                <span style={{ fontSize: 11, color: t.muted }}>/ {selectedMonthSundays} ({rate}%)</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 10px' }}>
                              <select value={rec.exit_type} onChange={e => updateAtt(m.id, 'exit_type', e.target.value)}
                                style={{ border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }}>
                                <option value="none">Still in cell</option>
                                <option value="transferred">Transferred out</option>
                                <option value="delisted">Delisted / Inactive</option>
                              </select>
                            </td>
                            <td style={{ padding: '10px 10px' }}>
                              {rec.exit_type !== 'none' ? (
                                <input
                                  type="date"
                                  value={rec.exit_date}
                                  onChange={e => updateAtt(m.id, 'exit_date', e.target.value)}
                                  style={{ border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }}
                                />
                              ) : (
                                <span style={{ color: t.muted, fontSize: 11 }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 10px' }}>
                              <input
                                value={rec.notes}
                                onChange={e => updateAtt(m.id, 'notes', e.target.value)}
                                placeholder="Optional"
                                style={{ width: 120, border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 11, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: t.muted }}>
                    Green dot on a month means records have been saved. Records are pending fellowship head validation.
                  </div>
                  <button onClick={saveAttendance} disabled={savingAttendance}
                    style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingAttendance ? 0.7 : 1 }}>
                    {savingAttendance ? 'Saving...' : `Save ${selectedMonthLabel} records`}
                  </button>
                </div>
              </div>
            )}

            {/* Info box */}
            <div style={{ background: t.purpleBg, borderRadius: 10, padding: '12px 14px', border: `0.5px solid rgba(83,74,183,0.15)`, fontSize: 11, color: t.purple, lineHeight: 1.7 }}>
              <strong>How this works:</strong> Enter the number of Sundays each member attended from your cell register. If a member transferred or became inactive during this month, select that from the Status column and enter the date. Your fellowship head will validate these records before they appear on the pastor dashboard. No absence alerts will fire for past months.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
