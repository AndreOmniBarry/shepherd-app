'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CellOverview from '@/components/CellOverview';
import NotificationBell from '@/components/NotificationBell';
import PrayerRequestPanel from '@/components/PrayerRequestPanel';
import CellFollowup from '@/components/CellFollowup';
import { useScreenSize } from '@/hooks/useScreenSize';

type Tab = 'overview' | 'submit' | 'history' | 'prayer' | 'followup' | 'birthdays' | 'members' | 'assignments';

const THEMES = {
  light: {
    bg: '#F0EFF8', card: '#FFFFFF', nav: '#FFFFFF', navBorder: 'rgba(83,74,183,0.1)',
    text: '#1A1040', sub: '#5A5180', muted: '#9990CC', border: 'rgba(83,74,183,0.12)',
    input: '#F7F6FF', purple: '#534AB7', purpleBg: '#EEEDFE', purpleLight: '#7B74CC',
    teal: '#1D9E75', tealBg: '#E1F5EE', coral: '#D85A30', coralBg: '#FAECE7',
    amber: '#BA7517', amberBg: '#FAEEDA',
  },
  dark: {
    bg: '#0F0A2E', card: '#1A1340', nav: '#140F35', navBorder: 'rgba(255,255,255,0.06)',
    text: '#E8E5FF', sub: '#B8B0E8', muted: '#7870B0', border: 'rgba(255,255,255,0.08)',
    input: '#1F1850', purple: '#A89FFF', purpleBg: 'rgba(168,159,255,0.12)', purpleLight: '#C4BFFF',
    teal: '#2DD4AA', tealBg: 'rgba(45,212,170,0.12)', coral: '#F87171', coralBg: 'rgba(248,113,113,0.12)',
    amber: '#FCD34D', amberBg: 'rgba(252,211,77,0.12)',
  },
};

function AddMembersTab({ t, dark }: { t: Record<string, string>; dark: boolean }) {
  const [form, setForm] = React.useState({ full_name: '', phone: '', email: '', date_of_birth: '', gender: '', join_date: new Date().toISOString().split('T')[0] });
  const [pending, setPending] = React.useState<{ id: string; full_name: string; phone: string; status: string; created_at: string }[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetch('/api/update/member-additions', { credentials: 'include' })
      .then(r => r.json()).then(({ data }) => { if (data?.additions) setPending(data.additions); }).catch(() => {});
  }, [success]);

  async function submit() {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/update/member-additions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess('Member submitted for approval');
        setForm({ full_name: '', phone: '', email: '', date_of_birth: '', gender: '', join_date: new Date().toISOString().split('T')[0] });
        setTimeout(() => setSuccess(''), 4000);
      } else { const d = await res.json(); setError(d?.error?.message || 'Failed'); }
    } catch { setError('Network error'); }
    setSaving(false);
  }

  const cardStyle = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px', ...e });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={cardStyle()}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4 }}>Add a new member</div>
        <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>Submit details — your fellowship head will approve and add them to the church roster.</div>
        {success && <div style={{ background: t.tealBg, color: t.teal, borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 500, marginBottom: 10 }}>{success}</div>}
        {error && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 8, padding: '9px 12px', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 4 }}>Full name *</div>
            <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="First and last name"
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 4 }}>Phone</div>
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08012345678"
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 4 }}>Email</div>
            <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="optional"
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 4 }}>Gender</div>
            <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }}>
              <option value="">Select</option><option value="male">Male</option><option value="female">Female</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 4 }}>Date of birth</div>
            <input type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))}
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 4 }}>Date joined</div>
            <input type="date" value={form.join_date} onChange={e => setForm(p => ({ ...p, join_date: e.target.value }))}
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
        </div>
        <button onClick={submit} disabled={saving || !form.full_name.trim()}
          style={{ width: '100%', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving || !form.full_name.trim() ? 0.6 : 1 }}>
          {saving ? 'Submitting…' : 'Submit for approval'}
        </button>
      </div>
      {pending.length > 0 && (
        <div style={cardStyle()}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Your submissions</div>
          {pending.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < pending.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{a.full_name}</div>
                <div style={{ fontSize: 11, color: t.muted }}>{a.phone || '—'} · {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: a.status === 'approved' ? '#E1F5EE' : a.status === 'rejected' ? '#FAECE7' : '#FAEEDA', color: a.status === 'approved' ? '#085041' : a.status === 'rejected' ? '#993C1D' : '#633806' }}>
                {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CellPage() {
  const router = useRouter();
  const { width, isMobile } = useScreenSize();
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [cellName, setCellName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [fellowshipName, setFellowshipName] = useState('');
  const [visitCount, setVisitCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const t = dark ? THEMES.dark : THEMES.light;

  // Responsive content width
  const contentMaxWidth = isMobile ? '100%' : width < 1024 ? 760 : width < 1440 ? 960 : 1200;
  const contentPadding = isMobile ? '16px 16px' : '28px 32px';

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        if (data.role !== 'cell_leader') { router.push('/login'); return; }
        setCellName(data.cell_name || 'My Cell');
        setLeaderName(data.name || '');
        setFellowshipName(data.fellowship_name || '');
      })
      .catch(() => router.push('/login'));
  }, []);

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    router.push('/login');
  }

  const NAV_TABS = [
    { id: 'overview', label: 'Overview', icon: 'ti-layout-dashboard' },
    { id: 'submit', label: 'Attendance', icon: 'ti-calendar-check' },
    { id: 'history', label: 'History', icon: 'ti-history' },
    { id: 'prayer', label: 'Prayer', icon: 'ti-heart' },
    { id: 'followup', label: 'Follow-up', icon: 'ti-user-check' },
    { id: 'birthdays', label: 'Birthdays', icon: 'ti-cake' },
    { id: 'members', label: 'Members', icon: 'ti-users' },
    { id: 'assignments', label: 'My Assignments', icon: 'ti-calendar-check' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'var(--font-inter, Inter, sans-serif)' }}>
      {/* Top bar */}
      <div style={{ background: t.nav, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: '#534AB7', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 14, height: 14, background: '#fff', borderRadius: 3 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '-0.2px' }}>SHEP.HERD</div>
            {!isMobile && <div style={{ fontSize: 10, color: t.muted, lineHeight: 1 }}>{cellName} · {leaderName}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setDark(v => !v)} style={{ width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${t.navBorder}`, background: 'transparent', cursor: 'pointer', color: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {dark ? '☀' : '☾'}
          </button>
          <NotificationBell dark={dark} />
          <button onClick={logout} style={{ background: 'transparent', color: t.muted, border: 'none', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Tab navigation - horizontal scrollable on mobile, full on desktop */}
      <div style={{ background: t.nav, borderBottom: `0.5px solid ${t.navBorder}`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as const, scrollbarWidth: 'none' as const }}>
        <div style={{ display: 'flex', minWidth: 'max-content', padding: '0 24px' }}>
          {NAV_TABS.map(n => (
            <button key={n.id} onClick={() => setTab(n.id as Tab)}
              style={{ padding: '14px 18px', border: 'none', borderBottom: `2px solid ${tab === n.id ? t.purple : 'transparent'}`, background: tab === n.id ? t.purpleBg : 'transparent', color: tab === n.id ? t.purple : t.muted, fontSize: 13, fontWeight: tab === n.id ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' as const, transition: 'all 0.15s' }}>
              <i className={n.icon} style={{ fontSize: 14 }} />
              {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content - responsive width */}
      <div style={{ maxWidth: contentMaxWidth, margin: '0 auto', padding: contentPadding }}>

        {tab === 'overview' && <CellOverview dark={dark} screenWidth={width} />}

        {tab === 'submit' && (
          <div style={{ display: 'grid', gridTemplateColumns: width >= 1024 ? '1fr 1fr' : '1fr', gap: 20 }}>
            {/* Attendance submission form */}
            <AttendanceForm t={t} dark={dark} cellName={cellName} visitCount={visitCount} setVisitCount={setVisitCount} saving={saving} setSaving={setSaving} success={success} setSuccess={setSuccess} />
          </div>
        )}

        {tab === 'history' && <HistoryTab t={t} dark={dark} screenWidth={width} />}
        {tab === 'prayer' && <PrayerRequestPanel dark={dark} />}
        {tab === 'followup' && <CellFollowup dark={dark} />}
        {tab === 'birthdays' && <BirthdaysTab t={t} dark={dark} />}
        {tab === 'members' && <AddMembersTab t={t} dark={dark} />}
        {tab === 'assignments' && <MyAssignmentsTab t={t} dark={dark} />}
      </div>
    </div>
  );
}

function AttendanceForm({ t, dark, cellName, visitCount, setVisitCount, saving, setSaving, success, setSuccess }: {
  t: Record<string, string>; dark: boolean; cellName: string;
  visitCount: number; setVisitCount: (n: number) => void;
  saving: boolean; setSaving: (b: boolean) => void;
  success: string; setSuccess: (s: string) => void;
}) {
  const [members, setMembers] = useState<{ id: string; full_name: string; membership_status: string }[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, string>>({});
  const [serviceId, setServiceId] = useState('');
  const [services, setServices] = useState<{ id: string; service_date: string; service_number: number }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/cells/members', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.members) {
          setMembers(data.members);
          const init: Record<string, boolean> = {};
          data.members.forEach((m: { id: string }) => { init[m.id] = true; });
          setAttendance(init);
        }
      }).catch(() => {});

    fetch('/api/services/recent', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.services) {
          setServices(data.services);
          if (data.services.length > 0) setServiceId(data.services[0].id);
        }
      }).catch(() => {});
  }, []);

  async function submit() {
    if (!serviceId) { setError('Select a service first'); return; }
    setSaving(true); setError('');
    try {
      const entries = members.map(m => ({
        member_id: m.id,
        status: attendance[m.id] ? 'present' : 'absent',
        absence_reason: !attendance[m.id] ? absenceReasons[m.id] || null : null,
      }));
      const res = await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ service_id: serviceId, entries, visitor_count: visitCount }),
      });
      if (res.ok) { setSuccess('Attendance submitted successfully'); setTimeout(() => setSuccess(''), 4000); }
      else { const d = await res.json(); setError(d?.error?.message || 'Submission failed'); }
    } catch { setError('Network error'); }
    setSaving(false);
  }

  const present = Object.values(attendance).filter(Boolean).length;
  const absent = members.length - present;
  const card = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e });

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {success && <div style={{ background: t.tealBg, color: t.teal, borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>✓ {success}</div>}
        {error && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 9, padding: '10px 14px', fontSize: 13 }}>{error}</div>}

        <div style={card({ padding: '16px 18px' })}>
          <div style={{ fontSize: 12, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 8 }}>Service</div>
          <select value={serviceId} onChange={e => setServiceId(e.target.value)}
            style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none' }}>
            {services.map(s => <option key={s.id} value={s.id}>{new Date(s.service_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} — Service {s.service_number}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[{ label: 'Present', val: present, c: t.teal, bg: t.tealBg }, { label: 'Absent', val: absent, c: t.coral, bg: t.coralBg }, { label: 'Visitors', val: visitCount, c: t.amber, bg: t.amberBg }].map(k => (
            <div key={k.label} style={{ ...card({ padding: '12px', textAlign: 'center' as const }), background: k.bg }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.val}</div>
              <div style={{ fontSize: 11, color: k.c, opacity: 0.8 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={card({ padding: '14px 16px' })}>
          <div style={{ fontSize: 12, color: t.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 12 }}>Visitor count</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setVisitCount(Math.max(0, visitCount - 1))} style={{ width: 36, height: 36, borderRadius: 8, border: `0.5px solid ${t.border}`, background: t.input, fontSize: 18, cursor: 'pointer', color: t.text }}>−</button>
            <span style={{ fontSize: 20, fontWeight: 700, color: t.text, minWidth: 40, textAlign: 'center' as const }}>{visitCount}</span>
            <button onClick={() => setVisitCount(visitCount + 1)} style={{ width: 36, height: 36, borderRadius: 8, border: `0.5px solid ${t.border}`, background: t.input, fontSize: 18, cursor: 'pointer', color: t.text }}>+</button>
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          style={{ width: '100%', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Submitting…' : 'Submit attendance'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Mark attendance ({members.length} members)</div>
        {members.map(m => {
          const present = attendance[m.id];
          return (
            <div key={m.id} style={{ background: t.card, border: `0.5px solid ${present ? 'rgba(29,158,117,0.2)' : 'rgba(216,90,48,0.2)'}`, borderRadius: 10, overflow: 'hidden' }}>
              <button onClick={() => setAttendance(p => ({ ...p, [m.id]: !p[m.id] }))}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', cursor: 'pointer', background: present ? t.tealBg : t.coralBg, border: 'none', textAlign: 'left' as const }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{m.full_name}</div>
                  <div style={{ fontSize: 10, color: t.muted }}>{m.membership_status}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: present ? t.teal : t.coral }}>{present ? 'Present' : 'Absent'}</span>
              </button>
              {!present && (
                <select value={absenceReasons[m.id] || ''} onChange={e => setAbsenceReasons(p => ({ ...p, [m.id]: e.target.value }))}
                  style={{ width: '100%', border: 'none', borderTop: `0.5px solid ${t.border}`, padding: '8px 14px', fontSize: 12, background: t.input, color: t.text, outline: 'none', cursor: 'pointer' }}>
                  <option value="">Select reason…</option>
                  <option value="sick">Sick / Unwell</option>
                  <option value="travel">Travelling</option>
                  <option value="work">Work / Engagement</option>
                  <option value="informed">Informed in advance</option>
                  <option value="bereavement">Bereavement</option>
                  <option value="unknown">Unknown</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function HistoryTab({ t, dark, screenWidth }: { t: Record<string, string>; dark: boolean; screenWidth: number }) {
  const [records, setRecords] = useState<{ id: string; service_date: string; present_count: number; absent_count: number; visitor_count: number; sla_grade: string; submitted_at: string }[]>([]);

  useEffect(() => {
    fetch('/api/attendance?scope=cell&weeks=12', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.records) setRecords(data.records); })
      .catch(() => {});
  }, []);

  const card = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e });

  if (records.length === 0) return (
    <div style={{ ...card({ padding: 40, textAlign: 'center' as const }) }}>
      <div style={{ fontSize: 14, color: t.muted }}>No attendance history yet.</div>
      <div style={{ fontSize: 12, color: t.muted, marginTop: 6 }}>Submit attendance on Sunday to see your history here.</div>
    </div>
  );

  return (
    <div style={card({ padding: 0, overflow: 'hidden' })}>
      <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${t.border}`, fontSize: 13, fontWeight: 600, color: t.text }}>Attendance History — Last 12 Weeks</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
              {['Date', 'Present', 'Absent', 'Visitors', 'SLA', 'Submitted'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, fontSize: 10, color: t.muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.4px', whiteSpace: 'nowrap' as const }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                <td style={{ padding: '12px 16px', color: t.text, fontWeight: 500 }}>{r.service_date ? new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                <td style={{ padding: '12px 16px', color: t.teal, fontWeight: 600 }}>{r.present_count ?? '—'}</td>
                <td style={{ padding: '12px 16px', color: t.coral }}>{r.absent_count ?? '—'}</td>
                <td style={{ padding: '12px 16px', color: t.amber }}>{r.visitor_count ?? 0}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: r.sla_grade === 'A+' || r.sla_grade === 'A' ? t.tealBg : r.sla_grade === 'B' ? t.amberBg : t.coralBg, color: r.sla_grade === 'A+' || r.sla_grade === 'A' ? t.teal : r.sla_grade === 'B' ? t.amber : t.coral }}>{r.sla_grade || '—'}</span>
                </td>
                <td style={{ padding: '12px 16px', color: t.muted, fontSize: 11 }}>{r.submitted_at ? new Date(r.submitted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BirthdaysTab({ t, dark }: { t: Record<string, string>; dark: boolean }) {
  const [birthdays, setBirthdays] = useState<{ id: string; full_name: string; date_of_birth: string; days_until: number }[]>([]);

  useEffect(() => {
    fetch('/api/birthdays?scope=cell', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.birthdays) setBirthdays(data.birthdays); })
      .catch(() => {});
  }, []);

  const card = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e });

  return (
    <div style={card({ padding: 0, overflow: 'hidden' })}>
      <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${t.border}`, fontSize: 13, fontWeight: 600, color: t.text }}>Upcoming Birthdays — Next 30 days</div>
      {birthdays.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: t.muted, fontSize: 13 }}>No birthdays in the next 30 days.</div>
      ) : (
        birthdays.map((b, i) => (
          <div key={b.id} style={{ padding: '12px 18px', borderBottom: i < birthdays.length - 1 ? `0.5px solid ${t.border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{b.full_name}</div>
              <div style={{ fontSize: 11, color: t.muted }}>{new Date(b.date_of_birth + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: b.days_until === 0 ? t.purpleBg : b.days_until <= 7 ? t.amberBg : t.tealBg, color: b.days_until === 0 ? t.purple : b.days_until <= 7 ? t.amber : t.teal }}>
              {b.days_until === 0 ? '🎂 Today!' : b.days_until === 1 ? 'Tomorrow' : `${b.days_until} days`}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function MyAssignmentsTab({ t, dark }: { t: Record<string, string>; dark: boolean }) {
  const [assignments, setAssignments] = React.useState<{
    plan_id: string; plan_title: string; service_date: string;
    item_type: string; title: string; description: string; duration_minutes: number;
    roster_dept?: string; roster_date?: string; roster_role?: string; source: 'service_plan'|'roster';
  }[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Fetch user id first
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(async ({ data }) => {
        if (!data?.id) return;
        const [planItemsRes, rosterRes] = await Promise.all([
          fetch(`/api/service-planner/items?assigned_to=${data.id}`, { credentials: 'include' }),
          fetch(`/api/workforce/rosters`, { credentials: 'include' }),
        ]);
        const [planItemsData, rosterData] = await Promise.all([
          planItemsRes.json(), rosterRes.json(),
        ]);

        const serviceItems: typeof assignments = [];
        const planItems = planItemsData?.data?.items || [];

        // Fetch plan details for each item
        if (planItems.length > 0) {
          const planIds = [...new Set(planItems.map((i: Record<string,unknown>) => i.plan_id))];
          const plansRes = await fetch('/api/service-planner?upcoming=true', { credentials: 'include' });
          const plansData = await plansRes.json();
          const plans = plansData?.data?.plans || [];

          planItems.forEach((item: Record<string,unknown>) => {
            const plan = plans.find((p: Record<string,unknown>) => p.id === item.plan_id);
            if (plan) {
              serviceItems.push({
                plan_id: plan.id as string,
                plan_title: plan.title as string,
                service_date: plan.service_date as string,
                item_type: item.item_type as string,
                title: item.title as string,
                description: item.description as string,
                duration_minutes: item.duration_minutes as number,
                source: 'service_plan',
              });
            }
          });
        }

        // Find roster assignments for this member
        const rosters = rosterData?.data?.rosters || [];
        const today = new Date().toISOString().split('T')[0];
        rosters.forEach((r: Record<string,unknown>) => {
          if ((r.service_date as string) < today) return;
          const entries = (r.entries as Record<string,unknown>[]) || [];
          entries.forEach((e: Record<string,unknown>) => {
            if (e.member_id === data.id) {
              serviceItems.push({
                plan_id: r.id as string,
                plan_title: `${r.department_id} Rota`,
                service_date: r.service_date as string,
                item_type: 'roster',
                title: e.role_title as string,
                description: e.position as string || '',
                duration_minutes: 0,
                roster_role: e.role_title as string,
                source: 'roster',
              });
            }
          });
        });

        serviceItems.sort((a, b) => a.service_date.localeCompare(b.service_date));
        setAssignments(serviceItems);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const ITEM_ICONS: Record<string,string> = { prayer:'🙏', song:'🎵', announcement:'📢', offering:'💰', sermon:'📖', item:'📋', benediction:'✝', break:'⏸', roster:'👥' };
  const card = (e?: React.CSSProperties): React.CSSProperties => ({ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, ...e });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ fontSize: 13, color: t.muted }}>Loading assignments…</div>
    </div>
  );

  if (assignments.length === 0) return (
    <div style={card({ padding: 40, textAlign: 'center' as const })}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>No upcoming assignments</div>
      <div style={{ fontSize: 12, color: t.muted }}>When the PA or department head assigns you a role in a service or rota, it will appear here.</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>My upcoming assignments</div>
      {assignments.map((a, i) => (
        <div key={i} style={card({ padding: '14px 16px', borderLeft: `3px solid ${a.source === 'service_plan' ? t.purple : t.teal}` })}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{ITEM_ICONS[a.item_type] || '📋'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{a.title}</div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
                {a.plan_title} · {new Date(a.service_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              {a.description && <div style={{ fontSize: 12, color: t.sub, marginTop: 4 }}>{a.description}</div>}
              {a.duration_minutes > 0 && <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Duration: {a.duration_minutes} min</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: a.source === 'service_plan' ? t.purpleBg : t.tealBg, color: a.source === 'service_plan' ? t.purple : t.teal, whiteSpace: 'nowrap' as const }}>
              {a.source === 'service_plan' ? 'Service Plan' : 'Rota'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
