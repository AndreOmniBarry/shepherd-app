'use client';
import { useTheme } from '@/hooks/useTheme';
import { useHeaderVisibility } from '@/hooks/useHeaderVisibility';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MyAccountButton from '@/components/MyAccountButton';
import Icon from '@/components/Icon';
import { SkeletonCard } from '@/components/Skeleton';
import LoadingScreen from '@/components/LoadingScreen';
import ChatNavButton from '@/components/ChatNavButton';
import { rolePortal } from '@/lib/role-portal';
import ThemeToggle from '@/components/ThemeToggle';

type Commendation = { id: string; title: string; body: string; read: boolean; created_at: string };
type MeetingRequest = { id: string; subject: string; message: string | null; proposed_time: string | null; status: string; created_at: string; responded_at: string | null; direction: 'sent' | 'received'; other_party: string };
type ServiceAssignment = { id: string; item_type: string; title: string; description: string | null; duration_minutes: number | null; is_completed: boolean; service_date: string; service_title: string; service_theme: string | null };
type WorkforceAssignment = { id: string; role_title: string; position: string | null; confirmed: boolean; service_date: string; service_type: string; department_name: string };
type Person = { id: string; full_name: string; role: string };

function formatDate(d: string) {
  const [y, mo, dy] = d.split('-').map(Number);
  return new Date(y, mo - 1, dy).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TABS = ['recognition', 'meetings', 'assignments'] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Record<Tab, string> = { recognition: 'Recognition', meetings: 'Meeting Requests', assignments: 'My Assignments' };

export default function ChurchCenterPage() {
  const router = useRouter();
  const {dark, setDark} = useTheme();
  const headerHidden = useHeaderVisibility();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [pageReady, setPageReady] = useState(false);
  const [homePath, setHomePath] = useState('/dashboard');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('recognition');

  const [commendations, setCommendations] = useState<Commendation[]>([]);
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([]);
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([]);
  const [workforceAssignments, setWorkforceAssignments] = useState<WorkforceAssignment[]>([]);

  const [people, setPeople] = useState<Person[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqOf, setReqOf] = useState('');
  const [reqSubject, setReqSubject] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [reqTime, setReqTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const t = {
    bg: dark ? '#080614' : '#F0EFF8', card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    coral: dark ? '#F0876B' : '#D85A30', coralBg: dark ? '#2E1610' : '#FAECE7',
    navBg: dark ? '#0A0618' : '#FFFFFF', navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
    input: dark ? '#0A0618' : '#FFFFFF',
  };

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(({ data }) => { if (!data) router.push('/login'); else setHomePath(rolePortal(data.role)); }).catch(() => router.push('/login'));
  }, [router]);

  // Deep-link support — a notification can send someone straight to the
  // right sub-tab (e.g. a meeting request lands on "Meeting Requests", not
  // whatever tab happened to be selected first).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && (TABS as readonly string[]).includes(requested)) setTab(requested as Tab);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/church-center', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      setCommendations(data?.commendations || []);
      setMeetingRequests(data?.meeting_requests || []);
      setServiceAssignments(data?.service_assignments || []);
      setWorkforceAssignments(data?.workforce_assignments || []);
    }).finally(() => { setLoading(false); setPageReady(true); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/church-center/people', { credentials: 'include' }).then(r => r.json()).then(({ data }) => setPeople(data?.people || [])).catch(() => {});
  }, []);

  async function submitRequest() {
    if (!reqOf || !reqSubject.trim()) { setFormError('Choose a person and enter a subject.'); return; }
    setSubmitting(true); setFormError('');
    try {
      const res = await fetch('/api/meeting-requests', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_of: reqOf, subject: reqSubject.trim(), message: reqMessage.trim() || null, proposed_time: reqTime || null }),
      });
      const { error } = await res.json();
      if (error) { setFormError(error.message); return; }
      setShowRequestForm(false); setReqOf(''); setReqSubject(''); setReqMessage(''); setReqTime('');
      load();
    } finally { setSubmitting(false); }
  }

  async function respond(id: string, status: 'accepted' | 'declined' | 'cancelled') {
    await fetch(`/api/meeting-requests/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  const card: React.CSSProperties = { background: 'var(--glass-bg)', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(160%)', backdropFilter: 'blur(var(--glass-blur)) saturate(160%)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', padding: '16px 18px', transition: 'box-shadow var(--motion-medium) var(--ease-out-expo)' };
  const statusColor = (s: string) => s === 'accepted' ? { bg: t.tealBg, c: t.teal } : s === 'declined' || s === 'cancelled' ? { bg: t.coralBg, c: t.coral } : { bg: t.purpleBg, c: t.purple };

  if (!pageReady) return <LoadingScreen dark={dark} label="Loading Church Center…" />;

  return (
    <div data-theme={dark ? 'dark' : 'light'} className="shep-page-enter" style={{ minHeight: '100vh', background: dark ? `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.12), transparent 45%), ${t.bg}` : `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.06), transparent 45%), ${t.bg}`, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: t.navBg, WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)', borderBottom: `0.5px solid ${t.navBorder}`, boxShadow: dark ? '0 2px 10px rgba(0,0,0,0.35)' : '0 2px 10px rgba(31,25,71,0.10)', padding: isMobile ? 'calc(10px + env(safe-area-inset-top)) 14px 10px' : '0 20px', height: isMobile ? undefined : 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'sticky', top: 0, zIndex: 30, transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)', transition: 'transform 0.25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, minWidth: 0 }}>
          <button onClick={() => router.push(homePath)} title="Back to dashboard"
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            style={{ background: t.purpleBg, border: 'none', borderRadius: 'var(--radius-sm)', width: 30, height: 30, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--motion-fast) var(--ease-spring)', flexShrink: 0 }}>
            <Icon name="ti-arrow-left" size={15} />
          </button>
          {!isMobile ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
              <div style={{ fontSize: 10, color: t.muted }}>Church Center</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Church Center</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 8, flexShrink: 0 }}>
          <ChatNavButton t={t} compact /><NotificationBell dark={dark} compact={isMobile} /><MyAccountButton dark={dark} compact={isMobile} />
          <ThemeToggle dark={dark} setDark={setDark} border={t.border} compact={isMobile} />
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Church Center</div>
          <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>Recognition you've received, meeting requests, and every service or roster assignment — all in one place.</div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(tb => (
            <button key={tb} onClick={() => setTab(tb)}
              onMouseEnter={e => { if (tab !== tb) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              style={{ padding: '7px 15px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: tab === tb ? 600 : 400, background: tab === tb ? '#534AB7' : 'var(--glass-bg)', borderColor: tab === tb ? '#534AB7' : t.border, color: tab === tb ? '#fff' : t.sub, boxShadow: tab === tb ? '0 2px 10px rgba(83,74,183,0.3)' : 'none', transition: 'all var(--motion-fast) var(--ease-out-expo)' }}>
              {TAB_LABEL[tb]}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2].map(i => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : (
        <div key={tab} className="shep-tab-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'recognition' ? (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Recognition received</div>
            {commendations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>No commendations yet — they'll show up here as soon as leadership recognizes your work.</div>
            ) : commendations.map((c, i) => (
              <div key={c.id} style={{ padding: '12px 0', borderBottom: i < commendations.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{c.title}</div>
                <div style={{ fontSize: 12, color: t.sub, marginTop: 4 }}>{c.body}</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{formatDateTime(c.created_at)}</div>
              </div>
            ))}
          </div>
        ) : tab === 'meetings' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRequestForm(v => !v)}
                style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {showRequestForm ? 'Cancel' : '+ Request a meeting'}
              </button>
            </div>
            {showRequestForm && (
              <div style={card}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select value={reqOf} onChange={e => setReqOf(e.target.value)}
                    style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text }}>
                    <option value="">Who do you want to meet with?</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role.replace(/_/g, ' ')})</option>)}
                  </select>
                  <input value={reqSubject} onChange={e => setReqSubject(e.target.value)} placeholder="Subject"
                    style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text }} />
                  <textarea value={reqMessage} onChange={e => setReqMessage(e.target.value)} placeholder="Message (optional)" rows={3}
                    style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, resize: 'vertical', fontFamily: 'inherit' }} />
                  <input type="datetime-local" value={reqTime} onChange={e => setReqTime(e.target.value)}
                    style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text }} />
                  {formError && <div style={{ color: t.coral, fontSize: 12 }}>{formError}</div>}
                  <button onClick={submitRequest} disabled={submitting}
                    style={{ background: t.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}>
                    {submitting ? 'Sending…' : 'Send request'}
                  </button>
                </div>
              </div>
            )}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Meeting requests</div>
              {meetingRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>No meeting requests yet.</div>
              ) : meetingRequests.map((m, i) => {
                const sc = statusColor(m.status);
                return (
                  <div key={m.id} style={{ padding: '12px 0', borderBottom: i < meetingRequests.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{m.subject}</div>
                        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                          {m.direction === 'sent' ? `To ${m.other_party}` : `From ${m.other_party}`} · {formatDateTime(m.created_at)}
                          {m.proposed_time && ` · Proposed: ${formatDateTime(m.proposed_time)}`}
                        </div>
                        {m.message && <div style={{ fontSize: 12, color: t.sub, marginTop: 6 }}>{m.message}</div>}
                      </div>
                      <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: sc.bg, color: sc.c, fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{m.status}</span>
                    </div>
                    {m.status === 'pending' && m.direction === 'received' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => respond(m.id, 'accepted')} style={{ background: t.teal, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Accept</button>
                        <button onClick={() => respond(m.id, 'declined')} style={{ background: 'transparent', color: t.coral, border: `0.5px solid ${t.coral}`, borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Decline</button>
                      </div>
                    )}
                    {m.status === 'pending' && m.direction === 'sent' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => respond(m.id, 'cancelled')} style={{ background: 'transparent', color: t.muted, border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>Cancel request</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {serviceAssignments.length === 0 && workforceAssignments.length === 0 ? (
              <div style={card}><div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>No upcoming assignments right now.</div></div>
            ) : (
              <>
                {serviceAssignments.length > 0 && (
                  <div style={card}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Order of service</div>
                    {serviceAssignments.map((a, i) => (
                      <div key={a.id} style={{ padding: '10px 0', borderBottom: i < serviceAssignments.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{a.title}</div>
                            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{formatDate(a.service_date)} · {a.service_title}{a.service_theme ? ` — ${a.service_theme}` : ''}</div>
                          </div>
                          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: a.is_completed ? t.tealBg : t.purpleBg, color: a.is_completed ? t.teal : t.purple, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {a.is_completed ? 'Done' : a.item_type}
                          </span>
                        </div>
                        {a.description && <div style={{ fontSize: 12, color: t.sub, marginTop: 6 }}>{a.description}</div>}
                        {a.duration_minutes && <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{a.duration_minutes} min</div>}
                      </div>
                    ))}
                  </div>
                )}
                {workforceAssignments.length > 0 && (
                  <div style={card}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Workforce roster</div>
                    {workforceAssignments.map((a, i) => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < workforceAssignments.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{a.role_title}{a.position ? ` — ${a.position}` : ''}</div>
                          <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{formatDate(a.service_date)} · {a.department_name}</div>
                        </div>
                        <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: a.confirmed ? t.tealBg : t.purpleBg, color: a.confirmed ? t.teal : t.purple, fontWeight: 600 }}>
                          {a.confirmed ? 'Confirmed' : 'Unconfirmed'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
        </div>
        )}
      </div>
    </div>
  );
}
