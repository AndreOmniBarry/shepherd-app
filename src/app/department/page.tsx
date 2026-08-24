'use client';
import { useTheme } from '@/hooks/useTheme';
import { useHeaderVisibility } from '@/hooks/useHeaderVisibility';
import NotificationBell from "@/components/NotificationBell";
import MyAccountButton from "@/components/MyAccountButton";
import StructureOverview from '@/components/StructureOverview';
import BirthdayPanel from '@/components/BirthdayPanel';
import WorkforceServingTab from '@/components/WorkforceServingTab';
import CareEventsTab from '@/components/CareEventsTab';
import AttendanceHistoryPanel from '@/components/AttendanceHistoryPanel';
import Icon from '@/components/Icon';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChurchConfigStandalone } from '@/hooks/useChurchConfig';
import ChatNavButton from '@/components/ChatNavButton';
import LoadingScreen from '@/components/LoadingScreen';
import ThemeToggle from '@/components/ThemeToggle';
import GuideTour, { useFirstVisitGuide } from '@/components/GuideTour';
import GuideHelpPanel from '@/components/GuideHelpPanel';
import { useAppDialog } from '@/components/AppDialog';
import { gradeColors } from '@/lib/sla';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function dayNameOf(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return DAY_NAMES[new Date(y, mo - 1, d).getDay()];
}

function mostRecentServiceDay(serviceDays: string[]): string {
  const today = new Date();
  const days = serviceDays.length ? serviceDays : ['Sunday'];
  for (let back = 0; back < 14; back++) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    if (days.includes(DAY_NAMES[d.getDay()])) {
      return d.toISOString().split('T')[0];
    }
  }
  return today.toISOString().split('T')[0];
}

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

export default function DepartmentHeadPage() {
  const router = useRouter();
  const { alertUser, promptUser } = useAppDialog();
  const { config: churchConfig } = useChurchConfigStandalone();
  const [tab, setTab] = useState<'overview' | 'submit' | 'history' | 'roster' | 'serving' | 'birthdays' | 'events'>('overview');
  const {dark, setDark} = useTheme();
  const [tourOpen, setTourOpen] = useFirstVisitGuide('department');
  const [helpOpen, setHelpOpen] = useState(false);
  const headerHidden = useHeaderVisibility();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [pageReady, setPageReady] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<{ id: string; full_name: string; phone: string | null; cell_name: string | null }[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, string>>({});
  const [visitorCount, setVisitorCount] = useState(0);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceNumber, setServiceNumber] = useState(1);
  const [dayServiceCounts, setDayServiceCounts] = useState<Record<string, number>>({});
  const [specialServices, setSpecialServices] = useState<{ id: string; service_date: string; label: string; submitted: boolean }[]>([]);
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

  function loadMembers() {
    fetch('/api/department/members', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.members) {
          setMembers(data.members);
          setAttendance(prev => {
            const init: Record<string, 'present' | 'absent'> = { ...prev };
            data.members.forEach((m: DeptMember) => { if (!(m.id in init)) init[m.id] = 'present'; });
            return init;
          });
        }
      })
      .catch(() => {});
  }

  async function saveRole(memberId: string, role: string) {
    await fetch('/api/department/members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ member_id: memberId, role }),
    }).catch(() => {});
    loadMembers();
  }

  useEffect(() => {
    if (!showAddExisting || addSearch.trim().length < 2) { setAddResults([]); return; }
    const handle = setTimeout(() => {
      fetch(`/api/members/search?q=${encodeURIComponent(addSearch.trim())}`, { credentials: 'include' })
        .then(r => r.json()).then(({ data }) => { if (data?.members) setAddResults(data.members); }).catch(() => {});
    }, 300);
    return () => clearTimeout(handle);
  }, [addSearch, showAddExisting]);

  async function addExistingMember(memberId: string) {
    setAddingId(memberId);
    const res = await fetch('/api/department/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ member_id: memberId }),
    });
    if (res.ok) { loadMembers(); setAddSearch(''); setAddResults([]); }
    else await alertUser('Failed to add member.', { title: 'Add failed' });
    setAddingId(null);
  }

  async function recommendRemoval(memberId: string, memberName: string) {
    const reason = await promptUser(`Reason for recommending ${memberName}'s removal — sent to the PA for approval.`, {
      title: 'Recommend removal', placeholder: 'Reason for removal…', confirmLabel: 'Send for approval', required: true,
    });
    if (!reason) return;
    const res = await fetch('/api/update/member-removals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ member_id: memberId, reason }),
    });
    if (res.ok) await alertUser(`Removal recommendation for ${memberName} sent for approval.`, { title: 'Sent' });
    else { const e = await res.json().catch(() => ({})); await alertUser(e?.error?.message || 'Failed to submit.', { title: 'Submit failed' }); }
  }

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        setDeptName(data.department_name || 'Your Department');
        setLeaderName(data.name || '');
        setPageReady(true);
        if (data.branch_id) {
          fetch('/api/branches', { credentials: 'include' }).then(r => r.json()).then(({ data: bd }) => {
            const mine = (bd?.branches || []).find((b: { id: string }) => b.id === data.branch_id);
            if (mine?.day_service_counts) setDayServiceCounts(mine.day_service_counts);
          }).catch(() => {});
        }
      })
      .catch(() => router.push('/login'));

    fetch('/api/services/special/upcoming', { credentials: 'include' }).then(r => r.json()).then(({ data }) => setSpecialServices(data?.special_services || [])).catch(() => {});

    loadMembers();

  }, [router]);

  // Default to the most recent configured service day once church config
  // loads — the head can still change it to any date within the window.
  useEffect(() => {
    if (!serviceDate) setServiceDate(mostRecentServiceDay(churchConfig.service_days));
  }, [churchConfig.service_days, serviceDate]);

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

  const serviceDayName = serviceDate ? dayNameOf(serviceDate) : '';
  const isSanctionedSpecialDay = specialServices.some(s => s.service_date === serviceDate);
  const isValidServiceDay = !serviceDate || (churchConfig.service_days || ['Sunday']).includes(serviceDayName) || isSanctionedSpecialDay;
  const servicesForSelectedDay = dayServiceCounts[serviceDayName] || 1;

  async function submit() {
    if (!serviceDate) { setError('Please select a date.'); return; }
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
        body: JSON.stringify({ service_date: serviceDate, service_number: serviceNumber, entries, absence_reasons: absenceReasons }),
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

  if (!pageReady) return <LoadingScreen dark={dark} label="Loading your department…" />;

  if (submitted && submittedData) {
    const sla = gradeColors(submittedData.sla_grade) || gradeColors('A')!;
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
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, boxShadow: dark ? '0 2px 10px rgba(0,0,0,0.35)' : '0 2px 10px rgba(31,25,71,0.10)', padding: isMobile ? 'calc(10px + env(safe-area-inset-top)) 14px 10px' : '0 20px', height: isMobile ? undefined : 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'sticky', top: 0, zIndex: 30, transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)', transition: 'transform 0.25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, minWidth: 0 }}>
          {!isMobile && (
            <div style={{ width: 24, height: 24, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', width: 3, height: 17, background: '#A89FFF', borderRadius: 2 }} />
              <div style={{ position: 'absolute', width: 12, height: 3, background: '#A89FFF', borderRadius: 2 }} />
            </div>
          )}
          {!isMobile ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
              <div style={{ fontSize: 10, color: t.muted }}>{deptName}{leaderName ? ` · ${leaderName}` : ''}</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deptName}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 8, flexShrink: 0 }}>
          <ThemeToggle dark={dark} setDark={setDark} border={t.border} compact={isMobile} />
          <button onClick={() => setHelpOpen(true)} title="How to use this page" style={{ background: 'transparent', border: 'none', color: t.sub, cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="ti-help" size={16} strokeWidth={2.2}/></button>
          {isMobile ? (
            <>
              <button onClick={() => router.push("/church-center")} title="Church Center" style={{ background: 'transparent', border: 'none', color: t.sub, cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="ti-building" size={16} strokeWidth={2.2}/></button>
              <button onClick={() => router.push("/church-feed")} title="Church Feed" style={{ background: 'transparent', border: 'none', color: t.sub, cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="ti-speakerphone" size={16} strokeWidth={2.2}/></button>
            </>
          ) : (
            <>
              <button onClick={() => router.push("/church-center")} style={{ background: "transparent", border: "none", color: t.muted, fontSize: 12, cursor: "pointer", marginRight: 4 }}>Church Center</button>
              <button onClick={() => router.push("/church-feed")} style={{ background: "transparent", border: "none", color: t.muted, fontSize: 12, cursor: "pointer", marginRight: 4 }}>Church Feed</button>
            </>
          )}
          <ChatNavButton t={t} compact={isMobile} />
          {isMobile ? (
            <button onClick={() => router.push("/calendar")} title="Calendar" style={{ background: 'transparent', border: 'none', color: t.sub, cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="ti-calendar-event" size={16} strokeWidth={2.2}/></button>
          ) : (
            <button onClick={() => router.push("/calendar")} style={{ background: "transparent", border: "none", color: t.muted, fontSize: 12, cursor: "pointer", marginRight: 4 }}>Calendar</button>
          )}
          <NotificationBell dark={dark} compact={isMobile} /><MyAccountButton dark={dark} compact={isMobile} />
          {isMobile ? (
            <button onClick={logout} title="Sign out" style={{ background: 'transparent', color: t.muted, border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}><Icon name="ti-logout" size={16} strokeWidth={2.2}/></button>
          ) : (
            <button onClick={logout} style={{ background: "transparent", color: t.muted, border: "none", fontSize: 12, cursor: "pointer" }}>Sign out</button>
          )}
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '10px 20px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {[{ id: 'overview', label: 'Overview', icon: 'ti-layout-dashboard' }, { id: 'submit', label: 'Attendance', icon: 'ti-calendar-check' }, { id: 'history', label: 'History', icon: 'ti-history' }, { id: 'roster', label: 'Members', icon: 'ti-list' },
        { id: 'serving', label: 'Serving Schedule', icon: 'ti-user-check' },
        { id: 'birthdays', label: 'Birthdays', icon: 'ti-cake' },
        ...(/protocol|ushering/i.test(deptName) ? [{ id: 'events' as const, label: 'Events', icon: 'ti-calendar-event' }] : [])].map(n => (
          <button key={n.id} onClick={() => setTab(n.id as typeof tab)}
            onMouseEnter={e => { if (tab !== n.id) e.currentTarget.style.background = t.purpleBg; }}
            onMouseLeave={e => { if (tab !== n.id) e.currentTarget.style.background = 'transparent'; }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', border: 'none', borderRadius: 20, background: tab === n.id ? '#534AB7' : 'transparent', fontSize: 12, fontWeight: tab === n.id ? 600 : 500, color: tab === n.id ? '#fff' : t.muted, cursor: 'pointer', transition: 'all var(--motion-fast) var(--ease-out-expo)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            {n.icon && <Icon name={n.icon} size={13} />}{n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '20px 16px' }}>

        {tab === 'overview' && (
          <StructureOverview
            dark={dark} t={t} isMobile={isMobile}
            fetchUrl="/api/department/overview"
            structureKey="dept"
            unitLabel={churchConfig.tier1_label || 'Department'}
            emptyTitle="No department assigned."
            emptySubtitle="Contact your administrator."
          />
        )}

        {tab === 'events' && (
          <CareEventsTab t={t} isMobile={isMobile} />
        )}

        {/* SUBMIT */}
        {tab === 'submit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {specialServices.some(s => !s.submitted) && (
              <div style={{ background: t.purpleBg, borderRadius: 12, border: '0.5px solid rgba(83,74,183,0.2)', padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.purple, marginBottom: 8 }}>Special service days awaiting your attendance</div>
                {specialServices.filter(s => !s.submitted).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <div>
                      <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: t.muted }}>{s.service_date}</div>
                    </div>
                    <button onClick={() => { setServiceDate(s.service_date); setServiceNumber(1); }}
                      style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Submit for this day
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Service date */}
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Service date</div>
              <input type="date" value={serviceDate} max={new Date().toISOString().split('T')[0]} min={new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]}
                onChange={e => { setServiceDate(e.target.value); setServiceNumber(1); }}
                style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', background: t.input, color: t.text }} />
              {servicesForSelectedDay > 1 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Which {serviceDayName} service?</div>
                  <select value={serviceNumber} onChange={e => setServiceNumber(Number(e.target.value))}
                    style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', background: t.input, color: t.text }}>
                    {Array.from({ length: servicesForSelectedDay }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>Service {n}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>
                {serviceDate ? `${serviceDayName}, ${(() => { const [yr,mo,dy] = serviceDate.split('-').map(Number); return new Date(yr, mo-1, dy).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); })()}` : ''} — records older than 14 days can&apos;t be submitted; contact your administrator.
              </div>
              {serviceDate && isSanctionedSpecialDay && (
                <div style={{ fontSize: 11, color: t.teal, marginTop: 6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="ti-check" size={13} /> Sanctioned special service day — {specialServices.find(s => s.service_date === serviceDate)?.label || 'special program'}.
                </div>
              )}
              {serviceDate && !isValidServiceDay && (
                <div style={{ fontSize: 11, color: t.amber, marginTop: 6 }}>
                  {serviceDayName} isn&apos;t one of your church&apos;s regular service days ({(churchConfig.service_days || ['Sunday']).join(', ')}) and no special program has been added for this date yet. Ask an admin to add it under Service Planner first.
                </div>
              )}
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

            <button onClick={submit} disabled={loading || !serviceDate}
              style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 12, padding: '15px', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading || !serviceDate ? 0.6 : 1 }}>
              {loading ? 'Submitting...' : `Submit — ${presentCount} Present · ${absentCount} Absent`}
            </button>
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Attendance trend</div>
              <AttendanceHistoryPanel t={t} color="#534AB7" fetchUrl={(g, o) => `/api/department/history?granularity=${g}&offset=${o}`} />
            </div>
            <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Last 12 weeks</div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>No submissions yet.</div>
              ) : (
                history.map((r, i) => {
                  const rate = Math.round((r.present_count / Math.max(1, r.present_count + r.absent_count)) * 100);
                  const sla = gradeColors(r.sla_grade) || gradeColors('A')!;
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

        {tab === 'serving' && (
          <WorkforceServingTab t={t} />
        )}

        {/* ROSTER */}
        {tab === 'roster' && (
          <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{deptName} — Members</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{members.length} members</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setShowAddExisting(v => !v)}
                  style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + Add existing member
                </button>
                <button onClick={() => { window.location.href = '/update'; }}
                  style={{ background: 'transparent', color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + New member
                </button>
              </div>
            </div>
            {showAddExisting && (
              <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${t.border}`, background: t.bg }}>
                <div style={{ fontSize: 12, color: t.muted, marginBottom: 8 }}>Search for a member already in the system to capture them into this department — for people who were missed during setup.</div>
                <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search by name (min. 2 characters)..."
                  style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.card, color: t.text, outline: 'none', marginBottom: 10 }} />
                {addResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {addResults.map(r => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.card, borderRadius: 8, padding: '8px 12px', border: `0.5px solid ${t.border}` }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{r.full_name}</div>
                          <div style={{ fontSize: 10, color: t.muted }}>{r.phone || '—'} · {r.cell_name || 'No cell'}</div>
                        </div>
                        <button onClick={() => addExistingMember(r.id)} disabled={addingId === r.id}
                          style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: addingId === r.id ? 0.6 : 1 }}>
                          {addingId === r.id ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {members.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: t.muted, fontSize: 13 }}>No roster found. Contact your administrator.</div>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(m => (
                  <div key={m.id} style={{ background: t.card, borderRadius: 10, border: `0.5px solid ${t.border}`, padding: '11px 13px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: t.text, marginBottom: 2 }}>{m.full_name}</div>
                    <div style={{ fontSize: 11, color: t.muted, marginBottom: 8 }}>{m.phone || '—'}</div>
                    <input defaultValue={m.role || ''} placeholder="e.g. Chorister, Alter Protocol..."
                      onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== (m.role || '')) saveRole(m.id, e.target.value.trim()); }}
                      style={{ border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 12, background: t.input || 'transparent', color: t.sub, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8 }} />
                    <button onClick={() => recommendRemoval(m.id, m.full_name)}
                      style={{ width: '100%', background: 'transparent', color: '#D85A30', border: '0.5px solid rgba(216,90,48,0.3)', borderRadius: 6, padding: '6px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Recommend removal
                    </button>
                  </div>
                ))}
              </div>
            ) : (
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                  {['Name', 'Role', 'Phone', ''].map(h => (
                    <th key={h||'actions'} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', background: t.card }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: t.text }}>{m.full_name}</td>
                    <td style={{ padding: '10px 14px', color: t.sub }}>
                      <input defaultValue={m.role || ''} placeholder="e.g. Chorister, Alter Protocol..."
                        onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== (m.role || '')) saveRole(m.id, e.target.value.trim()); }}
                        style={{ border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, background: t.input || 'transparent', color: t.sub, outline: 'none', width: '100%', maxWidth: 180, fontFamily: 'inherit' }} />
                    </td>
                    <td style={{ padding: '10px 14px', color: t.muted }}>{m.phone || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => recommendRemoval(m.id, m.full_name)}
                        style={{ background: 'transparent', color: '#D85A30', border: '0.5px solid rgba(216,90,48,0.3)', borderRadius: 6, padding: '4px 9px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                        Recommend removal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            )}
          </div>
        )}
      </div>
      <GuideTour portalKey="department" t={t} open={tourOpen} onClose={() => setTourOpen(false)} />
      {helpOpen && (
        <GuideHelpPanel portalKey="department" t={t} onClose={() => setHelpOpen(false)} onReplayTour={() => { setHelpOpen(false); setTourOpen(true); }} />
      )}
    </div>
  );
}
