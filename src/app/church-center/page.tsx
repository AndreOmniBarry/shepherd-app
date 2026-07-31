'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MyAccountButton from '@/components/MyAccountButton';
import Icon from '@/components/Icon';
import { rolePortal } from '@/lib/role-portal';

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
  const [dark, setDark] = useState(false);
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

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/church-center', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      setCommendations(data?.commendations || []);
      setMeetingRequests(data?.meeting_requests || []);
      setServiceAssignments(data?.service_assignments || []);
      setWorkforceAssignments(data?.workforce_assignments || []);
    }).finally(() => setLoading(false));
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

  const card: React.CSSProperties = { background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '16px 18px' };
  const statusColor = (s: string) => s === 'accepted' ? { bg: t.tealBg, c: t.teal } : s === 'declined' || s === 'cancelled' ? { bg: t.coralBg, c: t.coral } : { bg: t.purpleBg, c: t.purple };

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push(homePath)} title="Back to dashboard"
            style={{ background: t.purpleBg, border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ti-arrow-left" size={15} />
          </button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 10, color: t.muted }}>Church Center</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell dark={dark} /><MyAccountButton dark={dark} />
          <div onClick={() => setDark(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>
            {dark ? '☀' : '◑'}
          </div>
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
              style={{ padding: '6px 14px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: tab === tb ? 600 : 400, background: tab === tb ? '#534AB7' : t.card, borderColor: tab === tb ? '#534AB7' : t.border, color: tab === tb ? '#fff' : t.sub }}>
              {TAB_LABEL[tb]}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading…</div>
        ) : tab === 'recognition' ? (
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
    </div>
  );
}
