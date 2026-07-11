'use client';
import NotificationBell from "@/components/NotificationBell";
import BirthdayPanel from '@/components/BirthdayPanel';
import CellOverview from '@/components/CellOverview';
import PrayerRequestPanel from '@/components/PrayerRequestPanel';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Member = { id: string; full_name: string; membership_status: string; };
type Service = { id: string; service_date: string; service_number: number; };
type HistoryRecord = { id: string; service_date: string; service_number: number; present_count: number; absent_count: number; visitor_count: number; submitted_at: string; sla_grade?: string; };

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

export default function CellPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'submit' | 'history' | 'prayer' | 'birthdays'>('overview');
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, string>>({});
  const [visitorCount, setVisitorCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ present: number; absent: number; visitors: number; sla_grade: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [cellName, setCellName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [dark, setDark] = useState(false);

  const t = {
    bg: dark ? '#080614' : '#F0EFF8',
    card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040',
    sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC',
    input: dark ? '#0F0C20' : '#F7F6FF',
    purple: dark ? '#A89FFF' : '#534AB7',
    purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75',
    tealBg: dark ? '#0D2620' : '#E1F5EE',
    coral: dark ? '#F87171' : '#D85A30',
    coralBg: dark ? '#1F0A0A' : '#FAECE7',
    amber: dark ? '#FCD34D' : '#BA7517',
    amberBg: dark ? '#1F1A00' : '#FAEEDA',
    navBg: dark ? '#0A0618' : '#FFFFFF',
    navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
  };

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        setCellName(data.cell_name || 'Your Cell');
        setLeaderName(data.name || '');
      })
      .catch(() => router.push('/login'));

    fetch('/api/cells/members', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.members) {
          const active = data.members.filter((m: Member) => m.membership_status === 'active');
          setMembers(active);
          const init: Record<string, 'present' | 'absent'> = {};
          active.forEach((m: Member) => { init[m.id] = 'present'; });
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
      fetch('/api/attendance?weeks=12', { credentials: 'include' })
        .then(r => r.json())
        .then(({ data }) => {
          if (data?.records) {
            setHistory(data.records.map((r: Record<string, unknown>) => ({
              id: r.id,
              service_date: (r.services as Record<string, string>)?.service_date || '',
              service_number: (r.services as Record<string, number>)?.service_number || 1,
              present_count: r.present_count,
              absent_count: r.absent_count,
              visitor_count: r.visitor_count,
              submitted_at: r.submitted_at,
              sla_grade: r.sla_grade,
            })));
          }
        })
        .catch(() => {});
    }
  }, [tab]);

  function toggleAttendance(id: string) {
    setAttendance(prev => {
      const next = { ...prev, [id]: prev[id] === 'present' ? 'absent' : 'present' } as Record<string, 'present' | 'absent'>;
      // Clear absence reason if marked present
      if (next[id] === 'present') {
        setAbsenceReasons(r => { const nr = { ...r }; delete nr[id]; return nr; });
      }
      return next;
    });
  }

  function setReason(memberId: string, reason: string) {
    setAbsenceReasons(prev => ({ ...prev, [memberId]: reason }));
  }

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;
  const absentMembers = members.filter(m => attendance[m.id] === 'absent');

  async function submit() {
    if (!selectedService) { setError('Please select a service.'); return; }

    // Validate absence reasons
    const missingReasons = absentMembers.filter(m => !absenceReasons[m.id]);
    if (missingReasons.length > 0) {
      setError(`Please select an absence reason for: ${missingReasons.map(m => m.full_name.split(' ')[0]).join(', ')}`);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const entries = Object.entries(attendance).map(([member_id, status]) => ({ member_id, status }));
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          service_id: selectedService,
          entries,
          visitor_count: visitorCount,
          absence_reasons: absenceReasons,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || 'Submission failed. Please try again.');
      } else {
        setSubmittedData({
          present: json.data.present_count,
          absent: json.data.absent_count,
          visitors: json.data.visitor_count,
          sla_grade: json.data.sla_grade || 'A',
        });
        setSubmitted(true);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
    setLoading(false);
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  // ── Submission success screen ────────────────────────────────
  if (submitted && submittedData) {
    const slaColor = SLA_COLORS[submittedData.sla_grade] || SLA_COLORS['A'];
    return (
      <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,system-ui,sans-serif', padding: 16 }}>
        <div style={{ background: t.card, borderRadius: 16, border: `0.5px solid ${t.border}`, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: t.tealBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24, color: t.teal }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 6 }}>Attendance Submitted</div>
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 20 }}>Report sent to pastor dashboard in real time</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Present', value: submittedData.present, color: t.teal, bg: t.tealBg },
              { label: 'Absent', value: submittedData.absent, color: t.coral, bg: t.coralBg },
              { label: 'Visitors', value: submittedData.visitors, color: t.amber, bg: t.amberBg },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 8px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: slaColor.bg, borderRadius: 20, padding: '6px 14px', marginBottom: 24 }}>
            <span style={{ fontSize: 12, color: slaColor.text, fontWeight: 500 }}>SLA Grade:</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: slaColor.text }}>{submittedData.sla_grade}</span>
          </div>

          <button onClick={() => { setSubmitted(false); setVisitorCount(0); setAbsenceReasons({}); }}
            style={{ width: '100%', background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Submit Another Service
          </button>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* Nav */}
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: 3, height: 17, background: '#A89FFF', borderRadius: 2 }} />
            <div style={{ position: 'absolute', width: 12, height: 3, background: '#A89FFF', borderRadius: 2 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 10, color: t.muted }}>{cellName}{leaderName ? ` · ${leaderName}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div onClick={() => setDark(v => !v)}
            style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>
            {dark ? '☀' : '◑'}
          </div>
          <NotificationBell dark={dark} /><button onClick={logout} style={{ background: "transparent", color: t.muted, border: "none", fontSize: 12, cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', background: t.input, borderRadius: 10, padding: 4, marginBottom: 20, border: `0.5px solid ${t.border}` }}>
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'submit', label: 'Attendance' },
            { id: 'history', label: 'History' },
            { id: 'prayer', label: 'Prayer' },
            { id: 'birthdays', label: '🎂 Birthdays' },
          ] as const).map(tabDef => (
            <button key={tabDef.id} onClick={() => setTab(tabDef.id)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === tabDef.id ? 600 : 400, background: tab === tabDef.id ? t.card : 'transparent', color: tab === tabDef.id ? t.purple : t.sub, boxShadow: tab === tabDef.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
              {tabDef.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <CellOverview dark={dark} t={t} />
        )}
        {tab === 'submit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Service selector */}
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Select Service</div>
              {services.length === 0 ? (
                <div style={{ fontSize: 13, color: t.coral, padding: '8px 0' }}>No services available in the last 7 days. Contact your administrator.</div>
              ) : (
                <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', background: t.input, color: t.text, cursor: 'pointer' }}>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.service_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — Service {s.service_number}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Present', value: presentCount, color: t.teal, bg: t.tealBg },
                { label: 'Absent', value: absentCount, color: t.coral, bg: t.coralBg },
                { label: 'Visitors', value: visitorCount, color: t.amber, bg: t.amberBg },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: `0.5px solid ${t.border}` }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: s.color, opacity: 0.8, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Member list */}
            {members.length > 0 ? (
              <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Members ({members.length}) — tap to toggle
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(m => {
                    const present = attendance[m.id] === 'present';
                    return (
                      <div key={m.id}>
                        <button onClick={() => toggleAttendance(m.id)}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: 9, border: `0.5px solid ${present ? 'rgba(29,158,117,0.2)' : 'rgba(216,90,48,0.2)'}`, cursor: 'pointer', background: present ? t.tealBg : t.coralBg, textAlign: 'left' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: present ? t.teal : t.coral }}>{m.full_name}</span>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: present ? t.teal : t.coral, color: '#fff', fontWeight: 500 }}>
                            {present ? 'Present' : 'Absent'}
                          </span>
                        </button>

                        {/* Absence reason — only shows if absent */}
                        {!present && (
                          <div style={{ marginTop: 4, paddingLeft: 4 }}>
                            <select
                              value={absenceReasons[m.id] || ''}
                              onChange={e => setReason(m.id, e.target.value)}
                              style={{ width: '100%', border: `0.5px solid ${absenceReasons[m.id] ? 'rgba(216,90,48,0.3)' : t.coral}`, borderRadius: 7, padding: '7px 10px', fontSize: 12, outline: 'none', background: t.input, color: absenceReasons[m.id] ? t.text : t.coral, cursor: 'pointer' }}>
                              <option value="">Select reason for absence *</option>
                              {ABSENCE_REASONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: t.sub }}>No members found for this cell.</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Contact your administrator if this is incorrect.</div>
              </div>
            )}

            {/* Visitors */}
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Visitors / First-timers</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => setVisitorCount(v => Math.max(0, v - 1))}
                  style={{ width: 38, height: 38, borderRadius: 8, border: `0.5px solid ${t.border}`, background: t.input, fontSize: 20, cursor: 'pointer', color: t.text, fontWeight: 300 }}>−</button>
                <span style={{ fontSize: 26, fontWeight: 700, color: t.amber, width: 40, textAlign: 'center' }}>{visitorCount}</span>
                <button onClick={() => setVisitorCount(v => v + 1)}
                  style={{ width: 38, height: 38, borderRadius: 8, border: `0.5px solid ${t.border}`, background: t.input, fontSize: 20, cursor: 'pointer', color: t.text, fontWeight: 300 }}>+</button>
                <span style={{ fontSize: 12, color: t.muted }}>people who visited today</span>
              </div>
            </div>

            {/* SLA notice */}
            <div style={{ background: t.purpleBg, borderRadius: 10, padding: '10px 14px', border: `0.5px solid ${t.border}` }}>
              <div style={{ fontSize: 11, color: t.purple, fontWeight: 500, marginBottom: 2 }}>Submission window</div>
              <div style={{ fontSize: 11, color: t.sub }}>Submit by Sunday midnight for A+ · Monday before 6am for A · Monday midnight for B · Tuesday for C</div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: t.coralBg, borderRadius: 9, border: `0.5px solid rgba(216,90,48,0.3)`, padding: '11px 14px', fontSize: 13, color: t.coral }}>{error}</div>
            )}

            {/* Submit button */}
            <button onClick={submit} disabled={loading || !selectedService || services.length === 0}
              style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 12, padding: '15px', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading || !selectedService ? 0.6 : 1, letterSpacing: '0.3px' }}>
              {loading ? 'Submitting...' : `Submit — ${presentCount} Present · ${absentCount} Absent`}
            </button>
          </div>
        )}

        {tab === 'prayer' && (
          <PrayerRequestPanel dark={dark} t={t} />
        )}
        {tab === 'birthdays' && (
          <BirthdayPanel dark={dark} t={t} scope="cell" showFellowship={false} />
        )}
        {tab === 'history' && (
          <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Last 12 Weeks</div>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: t.muted, fontSize: 13 }}>No submissions yet. Your history will appear here after your first submission.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {history.map((r, i) => {
                  const rate = Math.round((r.present_count / Math.max(1, r.present_count + r.absent_count)) * 100);
                  const slaColor = SLA_COLORS[r.sla_grade || 'A'] || SLA_COLORS['A'];
                  return (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < history.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>
                          {r.service_date ? new Date(r.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'} · Svc {r.service_number}
                        </div>
                        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{r.absent_count} absent · {r.visitor_count} visitors</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.sla_grade && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: slaColor.bg, color: slaColor.text, fontWeight: 600 }}>{r.sla_grade}</span>
                        )}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: t.teal }}>{r.present_count}</div>
                          <div style={{ fontSize: 10, color: t.muted }}>{rate}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
