'use client';
import { useScreenSize } from '@/hooks/useScreenSize';
import NotificationBell from "@/components/NotificationBell";
import DeptOverview from '@/components/DeptOverview';
import BirthdayPanel from '@/components/BirthdayPanel';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type DeptMember = {
  id: string;
  full_name: string;
  role: string;
  phone: string;
  status: 'present' | 'absent' | null;
  absence_reason?: string;
  informed?: boolean;
};

type HistoryRecord = {
  id: string;
  service_date: string;
  present_count: number;
  absent_count: number;
  submitted_at: string;
  sla_grade?: string;
};

const ABSENCE_REASONS = [
  { value: 'informed', label: 'Informed in advance' },
  { value: 'sick', label: 'Sick / Unwell' },
  { value: 'travelling', label: 'Travelling' },
  { value: 'work', label: 'Work commitment' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'family', label: 'Family emergency' },
  { value: 'unknown', label: 'Unknown / Not informed' },
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

export default function DepartmentHeadPage() {
  const { width: screenWidth, isMobile } = useScreenSize();
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'submit' | 'history' | 'roster' | 'birthdays'>('overview');
  const [dark, setDark] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, string>>({});
  const [visitorCount, setVisitorCount] = useState(0);
  const [services, setServices] = useState<{ id: string; service_date: string; service_number: number }[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ present: number; absent: number; sla_grade: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        setDeptName(data.department_name || 'Your Department');
        setLeaderName(data.name || '');
      })
      .catch(() => router.push('/login'));

    fetch('/api/department/members', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.members) {
          setMembers(data.members);
          const init: Record<string, 'present' | 'absent'> = {};
          data.members.forEach((m: DeptMember) => { init[m.id] = 'present'; });
          setAttendance(init);
        }
      })
      .catch(() => {});

    fetch('/api/services/recent', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.services?.length) {
          setServices(data.services);
          setSelectedService(data.services[0].id);
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (tab === 'history') {
      fetch('/api/department/attendance?weeks=12', { credentials: 'include' })
        .then(r => r.json())
        .then(({ data }) => {
          if (data?.records) {
            // E13 fix: flatten nested services.service_date
            const mapped = data.records.map((r: Record<string,unknown>) => ({
              ...r,
              service_date: (r.services as Record<string,string>|null)?.service_date || (r.service_date as string) || null,
            }));
            setHistory(mapped);
          }
        })
        .catch(() => {});
    }
  }, [tab]);

  function toggle(id: string) {
    setAttendance(prev => {
      const next = { ...prev, [id]: prev[id] === 'present' ? 'absent' : 'present' } as Record<string, 'present' | 'absent'>;
      if (next[id] === 'present') {
        setAbsenceReasons(r => { const nr = { ...r }; delete nr[id]; return nr; });
      }
      return next;
    });
  }

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;
  const absentMembers = members.filter(m => attendance[m.id] === 'absent');

  async function submit() {
    if (!selectedService) { setError('Please select a service.'); return; }
    const missing = absentMembers.filter(m => !absenceReasons[m.id]);
    if (missing.length > 0) {
      setError(`Select absence reason for: ${missing.map(m => m.full_name.split(' ')[0]).join(', ')}`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const entries = Object.entries(attendance).map(([member_id, status]) => ({ member_id, status }));
      const res = await fetch('/api/department/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ service_id: selectedService, entries, absence_reasons: absenceReasons }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || 'Submission failed.');
      } else {
        setSubmittedData({ present: json.data.present_count, absent: json.data.absent_count, sla_grade: json.data.sla_grade || 'A' });
        setSubmitted(true);
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  if (submitted && submittedData) {
    const sla = SLA_COLORS[submittedData.sla_grade] || SLA_COLORS['A'];
    return (
      <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,system-ui,sans-serif', padding: 16 }}>
        <div style={{ background: t.card, borderRadius: 16, border: `0.5px solid ${t.border}`, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, background: t.tealBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22, color: t.teal }}>✓</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>Attendance Submitted</div>
          <div style={{ fontSize: 12, color: t.sub, marginBottom: 16 }}>Sent to pastor dashboard in real time</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: t.tealBg, borderRadius: 10, padding: '10px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.teal }}>{submittedData.present}</div>
              <div style={{ fontSize: 11, color: t.teal, opacity: 0.8 }}>Present</div>
            </div>
            <div style={{ background: t.coralBg, borderRadius: 10, padding: '10px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.coral }}>{submittedData.absent}</div>
              <div style={{ fontSize: 11, color: t.coral, opacity: 0.8 }}>Absent</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: sla.bg, borderRadius: 20, padding: '5px 14px', marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: sla.text, fontWeight: 500 }}>SLA Grade:</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: sla.text }}>{submittedData.sla_grade}</span>
          </div>
          <button onClick={() => { setSubmitted(false); setAbsenceReasons({}); }}
            style={{ width: '100%', background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 10, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Submit Another Service
          </button>
        </div>
      </div>
    );
  }

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
            <div style={{ fontSize: 10, color: t.muted }}>{deptName}{leaderName ? ` · ${leaderName}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div onClick={() => setDark(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>
            {dark ? '☀' : '◑'}
          </div>
          <NotificationBell dark={dark} /><button onClick={logout} style={{ background: "transparent", color: t.muted, border: "none", fontSize: 12, cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', display: 'flex' }}>
        {[{ id: 'overview', label: 'Overview', icon: 'ti-layout-dashboard' }, { id: 'submit', label: 'Attendance', icon: 'ti-calendar-check' }, { id: 'history', label: 'History', icon: 'ti-history' }, { id: 'roster', label: 'Roster', icon: 'ti-list' },
        { id: 'birthdays', label: '🎂 Birthdays' }].map(n => (
          <button key={n.id} onClick={() => setTab(n.id as typeof tab)}
            style={{ padding: '10px 16px', border: 'none', borderBottom: `2px solid ${tab === n.id ? t.purple : 'transparent'}`, background: tab === n.id ? t.purpleBg : 'transparent', fontSize: 12, fontWeight: tab === n.id ? 600 : 400, color: tab === n.id ? t.purple : t.muted, cursor: 'pointer', marginBottom: -0.5 }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: isMobile ? '16px 16px' : '24px 28px' }}>

        {tab === 'overview' && (
          <DeptOverview dark={dark} t={t} />
        )}

        {/* SUBMIT */}
        {tab === 'submit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Service */}
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Select Service</div>
              <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
                style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', background: t.input, color: t.text }}>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.service_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — Service {s.service_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Present', value: presentCount, color: t.teal, bg: t.tealBg },
                { label: 'Absent', value: absentCount, color: t.coral, bg: t.coralBg },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px', textAlign: 'center', border: `0.5px solid ${t.border}` }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: s.color, opacity: 0.8, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Member list */}
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Department members ({members.length}) — tap to toggle
              </div>
              {members.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: t.muted, fontSize: 13 }}>No members found. Contact your administrator.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(m => {
                    const present = attendance[m.id] === 'present';
                    return (
                      <div key={m.id}>
                        <button onClick={() => toggle(m.id)}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: 9, border: `0.5px solid ${present ? 'rgba(29,158,117,0.2)' : 'rgba(216,90,48,0.2)'}`, cursor: 'pointer', background: present ? t.tealBg : t.coralBg, textAlign: 'left' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: present ? t.teal : t.coral }}>{m.full_name}</div>
                            <div style={{ fontSize: 10, color: present ? t.teal : t.coral, opacity: 0.7, marginTop: 1 }}>{m.role}</div>
                          </div>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: present ? t.teal : t.coral, color: '#fff', fontWeight: 500 }}>
                            {present ? 'Present' : 'Absent'}
                          </span>
                        </button>
                        {!present && (
                          <div style={{ marginTop: 4, paddingLeft: 4 }}>
                            <select value={absenceReasons[m.id] || ''} onChange={e => setAbsenceReasons(prev => ({ ...prev, [m.id]: e.target.value }))}
                              style={{ width: '100%', border: `0.5px solid ${absenceReasons[m.id] ? 'rgba(216,90,48,0.3)' : t.coral}`, borderRadius: 7, padding: '7px 10px', fontSize: 12, outline: 'none', background: t.input, color: absenceReasons[m.id] ? t.text : t.coral, cursor: 'pointer' }}>
                              <option value="">Select reason for absence *</option>
                              {ABSENCE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SLA notice */}
            <div style={{ background: t.purpleBg, borderRadius: 10, padding: '10px 14px', border: `0.5px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.purple, fontWeight: 500, marginBottom: 2 }}>SLA reminder</div>
              <div style={{ fontSize: 11, color: t.sub }}>Submit by Sunday midnight for A+ · Monday midnight for B · No submission beyond Monday without a stated reason.</div>
            </div>

            {error && <div style={{ background: t.coralBg, borderRadius: 9, border: `0.5px solid rgba(216,90,48,0.3)`, padding: '11px 14px', fontSize: 13, color: t.coral }}>{error}</div>}

            <button onClick={submit} disabled={loading || !selectedService}
              style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 12, padding: '15px', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading || !selectedService ? 0.6 : 1 }}>
              {loading ? 'Submitting...' : `Submit — ${presentCount} Present · ${absentCount} Absent`}
            </button>
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {history.length > 0 && (
              <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Attendance trend</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={history.slice(0, 8).reverse().map((r, i) => ({ w: `W${i + 1}`, v: r.present_count }))} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} />
                    <XAxis dataKey="w" tick={{ fontSize: 9, fill: t.chartAxis }} />
                    <YAxis tick={{ fontSize: 9, fill: t.chartAxis }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: t.chartTip, color: t.chartTipText }} />
                    <Bar dataKey="v" fill="#534AB7" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Last 12 weeks</div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>No submissions yet.</div>
              ) : (
                history.map((r, i) => {
                  const rate = Math.round((r.present_count / Math.max(1, r.present_count + r.absent_count)) * 100);
                  const sla = SLA_COLORS[r.sla_grade || 'A'] || SLA_COLORS['A'];
                  return (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < history.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>
                          {r.service_date ? new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                        <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>{r.absent_count} absent</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.sla_grade && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: sla.bg, color: sla.text, fontWeight: 600 }}>{r.sla_grade}</span>}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: t.teal }}>{r.present_count}</div>
                          <div style={{ fontSize: 10, color: t.muted }}>{rate}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'birthdays' && (
          <BirthdayPanel dark={dark} t={t} scope="department" showFellowship={false} />
        )}

        {/* ROSTER */}
        {tab === 'roster' && (
          <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{deptName} — Full Roster</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{members.length} members</div>
              </div>
              <button onClick={() => { window.location.href = '/update'; }}
                style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Add member
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                  {['Name', 'Role', 'Phone'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: t.text }}>{m.full_name}</td>
                    <td style={{ padding: '10px 14px', color: t.sub }}>{m.role}</td>
                    <td style={{ padding: '10px 14px', color: t.muted }}>{m.phone || '—'}</td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: t.muted, fontSize: 13 }}>No roster found. Contact your administrator.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
