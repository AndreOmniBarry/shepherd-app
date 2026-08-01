'use client';
import { useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import { SkeletonRow } from '@/components/Skeleton';

type ChurchEvent = {
  id: string; title: string; event_type: string; event_date: string; end_date: string | null; start_time: string | null;
  location: string | null; is_free: boolean; price: number; capacity: number | null;
  public_slug: string; registration_open: boolean; status: string; registration_count: number;
};
type Registrant = {
  id: string; full_name: string; phone: string; email: string | null; is_member: boolean; payment_status: string; attended: boolean; registered_at: string;
  attending_days: string[] | null; guest_type: string; companion_count: number; expectations: string | null;
};
type EventStats = ChurchEvent & { registrations: number; attended: number; expected_headcount: number; attendance_rate: number };

const EVENT_TYPES = ['programme','conference','vigil','concert','outreach','training','thanksgiving','dedication','other'];

export default function EventsPanel({ t, isMobile = false }: { t: Record<string, string>; isMobile?: boolean }) {
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', event_date: '', end_date: '', event_type: 'programme', start_time: '', location: '', is_free: true, price: '', capacity: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'manage' | 'analytics'>('manage');
  const [eventStats, setEventStats] = useState<EventStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const [selected, setSelected] = useState<ChurchEvent | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loadingRegistrants, setLoadingRegistrants] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number; provider_configured: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const [checkinMode, setCheckinMode] = useState<'member'|'visitor'>('member');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<{id:string;full_name:string;phone:string}[]>([]);
  const [pickedMember, setPickedMember] = useState<{id:string;full_name:string}|null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorPrayer, setVisitorPrayer] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinError, setCheckinError] = useState('');
  const [checkinSuccess, setCheckinSuccess] = useState('');

  function loadEvents() {
    fetch('/api/events', { credentials: 'include' }).then(r => r.json()).then(({ data }) => setEvents(data?.events || [])).finally(() => setLoading(false));
  }
  function loadStats() {
    setStatsLoading(true);
    fetch('/api/events/analytics', { credentials: 'include' }).then(r => r.json()).then(({ data }) => setEventStats(data?.events || [])).finally(() => setStatsLoading(false));
  }
  useEffect(() => { loadEvents(); }, []);
  useEffect(() => { if (view === 'analytics') loadStats(); }, [view]);

  async function createEvent() {
    if (!form.title.trim() || !form.event_date) { setError('Title and date are required'); return; }
    if (form.end_date && form.end_date < form.event_date) { setError('End date cannot be before the start date'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ...form, end_date: form.end_date || null, price: form.is_free ? 0 : Number(form.price) || 0, capacity: form.capacity ? Number(form.capacity) : null }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowNew(false);
        setForm({ title: '', event_date: '', end_date: '', event_type: 'programme', start_time: '', location: '', is_free: true, price: '', capacity: '' });
        loadEvents();
      } else setError(json.error?.message || 'Failed to create event');
    } catch { setError('Network error — event was not created.'); }
    setSaving(false);
  }

  async function toggleRegistration(ev: ChurchEvent) {
    setClosingId(ev.id);
    try {
      const res = await fetch('/api/events', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: ev.id, registration_open: !ev.registration_open }),
      });
      if (res.ok) {
        loadEvents();
        if (selected?.id === ev.id) setSelected(s => s ? { ...s, registration_open: !ev.registration_open } : s);
      }
    } catch {}
    setClosingId(null);
  }

  function viewRegistrants(ev: ChurchEvent) {
    setSelected(ev); setBroadcastResult(null); setBroadcastMsg('');
    setLoadingRegistrants(true);
    fetch(`/api/events/register?event_id=${ev.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => setRegistrants(data?.registrations || []))
      .finally(() => setLoadingRegistrants(false));
  }

  async function sendBroadcast() {
    if (!selected || !broadcastMsg.trim()) return;
    setBroadcasting(true); setBroadcastResult(null);
    try {
      const res = await fetch('/api/events/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ event_id: selected.id, message: broadcastMsg.trim() }),
      });
      const json = await res.json();
      if (res.ok) { setBroadcastResult(json.data); setBroadcastMsg(''); }
      else setError(json.error?.message || 'Failed to broadcast');
    } catch { setError('Network error — broadcast was not sent.'); }
    setBroadcasting(false);
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/events/${slug}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  useEffect(() => {
    if (memberQuery.trim().length < 2) { setMemberResults([]); return; }
    const handle = setTimeout(() => {
      fetch(`/api/members/search?q=${encodeURIComponent(memberQuery.trim())}`, { credentials: 'include' })
        .then(r => r.json())
        .then(({ data }) => setMemberResults(data?.members || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(handle);
  }, [memberQuery]);

  async function checkIn() {
    if (!selected) return;
    if (checkinMode === 'member' && !pickedMember) { setCheckinError('Select a member first'); return; }
    if (checkinMode === 'visitor' && !visitorName.trim()) { setCheckinError('Name is required'); return; }
    setCheckingIn(true); setCheckinError(''); setCheckinSuccess('');
    try {
      const res = await fetch('/api/events/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          event_id: selected.id, is_new_visitor: checkinMode === 'visitor',
          member_id: pickedMember?.id, full_name: checkinMode === 'visitor' ? visitorName.trim() : pickedMember?.full_name,
          phone: visitorPhone.trim() || undefined, prayer_point: visitorPrayer.trim() || undefined,
          how_they_came: 'event',
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setCheckinSuccess(checkinMode==='visitor' ? `${visitorName.trim()} checked in — routed to care team.` : `${pickedMember?.full_name} checked in.`);
        setPickedMember(null); setMemberQuery(''); setVisitorName(''); setVisitorPhone(''); setVisitorPrayer('');
        viewRegistrants(selected);
        setTimeout(() => setCheckinSuccess(''), 4000);
      } else setCheckinError(json.error?.message || 'Failed to check in');
    } catch { setCheckinError('Network error — check-in did not go through.'); }
    setCheckingIn(false);
  }

  if (loading) return <div style={{ fontSize: 12, color: t.sub, padding: 20 }}>Loading events…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Events</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Create programmes, share the public registration link, and message everyone who signed up.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: t.input, borderRadius: 8, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
            {(['manage', 'analytics'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '8px 14px', border: 'none', background: view === v ? t.purple : 'transparent', color: view === v ? '#fff' : t.sub, fontSize: 11, fontWeight: view === v ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                {v}
              </button>
            ))}
          </div>
          {view === 'manage' && (
            <button onClick={() => setShowNew(v => !v)} style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {showNew ? 'Cancel' : '+ New event'}
            </button>
          )}
        </div>
      </div>

      {showNew && view === 'manage' && (
        <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title"
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
            <div>
              <div style={{ fontSize: 9, color: t.muted, marginBottom: 3 }}>Start date</div>
              <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: t.muted, marginBottom: 3 }}>End date (multi-day — optional)</div>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
              {EVENT_TYPES.map(ty => (<option key={ty} value={ty}>{ty}</option>))}
            </select>
            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location"
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.is_free} onChange={e => setForm(f => ({ ...f, is_free: e.target.checked }))} /> Free event
            </label>
            {!form.is_free && (
              <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Price" type="number"
                style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', width: 120 }} />
            )}
            <input value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Capacity (optional)" type="number"
              style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', width: 160 }} />
          </div>
          {error && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>{error}</div>}
          <button onClick={createEvent} disabled={saving} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
            {saving ? 'Creating…' : 'Create event'}
          </button>
        </div>
      )}

      {view === 'manage' && (
      <div style={{ display: 'grid', gridTemplateColumns: selected && !isMobile ? '1fr 1fr' : '1fr', gap: 14 }}>
        <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>All Events</div>
          {events.length === 0 ? (
            <div style={{ fontSize: 12, color: t.muted }}>No events created yet.</div>
          ) : events.map(ev => (
            <div key={ev.id} onClick={() => viewRegistrants(ev)}
              style={{ padding: '10px 0', borderBottom: `0.5px solid ${t.border}`, cursor: 'pointer', background: selected?.id === ev.id ? t.purpleBg : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{ev.title}{!ev.registration_open && <span style={{ fontSize: 9, color: t.coral, marginLeft: 6, fontWeight: 600 }}>CLOSED</span>}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="ti-calendar-event" size={11} /> {ev.event_date}{ev.end_date && ev.end_date !== ev.event_date ? ` – ${ev.end_date}` : ''}{ev.location ? <><Icon name="ti-map-pin" size={11} /> {ev.location}</> : null}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.purple }}>{ev.registration_count}{ev.capacity ? `/${ev.capacity}` : ''}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <button onClick={e => { e.stopPropagation(); copyLink(ev.public_slug); }} style={{ background: 'transparent', border: 'none', color: t.sub, fontSize: 10, cursor: 'pointer' }}>
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); toggleRegistration(ev); }} disabled={closingId === ev.id} style={{ background: 'transparent', border: 'none', color: ev.registration_open ? t.coral : t.teal, fontSize: 10, cursor: 'pointer' }}>
                      {closingId === ev.id ? '…' : ev.registration_open ? 'Collapse link' : 'Reopen link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>{selected.title} — Registrants</div>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 12 }}>{registrants.length} registered</div>

            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
              {loadingRegistrants ? (
                <>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</>
              ) : registrants.length === 0 ? (
                <div style={{ fontSize: 12, color: t.muted }}>No one has registered yet.</div>
              ) : registrants.map(r => (
                <div key={r.id} style={{ padding: '6px 0', borderBottom: `0.5px solid ${t.border}`, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: t.text }}>
                      {r.full_name}
                      {!r.is_member && <span style={{fontSize:9,color:t.amber,marginLeft:4}}>VISITOR</span>}
                      {r.guest_type === 'minister' && <span style={{fontSize:9,color:t.purple,marginLeft:4,fontWeight:600}}>MINISTER</span>}
                      {r.companion_count > 0 && <span style={{fontSize:10,color:t.muted,marginLeft:4}}>+{r.companion_count}</span>}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: t.muted }}>{r.phone}</span>
                      {r.attended && <span style={{fontSize:9,padding:'2px 7px',borderRadius:8,background:t.tealBg,color:t.teal,fontWeight:600}}>Attended</span>}
                    </span>
                  </div>
                  {(r.attending_days?.length || r.expectations) && (
                    <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>
                      {r.attending_days?.length ? `Attending: ${r.attending_days.join(', ')}` : ''}
                      {r.attending_days?.length && r.expectations ? ' · ' : ''}
                      {r.expectations ? `"${r.expectations}"` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Check in an attendee</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {(['member','visitor'] as const).map(m => (
                <button key={m} onClick={() => { setCheckinMode(m); setCheckinError(''); }}
                  style={{ background: checkinMode===m?t.purple:'transparent', color: checkinMode===m?'#fff':t.muted, border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {m==='member'?'Existing member':'New visitor'}
                </button>
              ))}
            </div>
            {checkinMode==='member' ? (
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input value={pickedMember?pickedMember.full_name:memberQuery} onChange={e=>{setMemberQuery(e.target.value);setPickedMember(null);}} placeholder="Search member by name..."
                  style={{ width:'100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
                {!pickedMember && memberResults.length>0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background:t.card, border:`0.5px solid ${t.border}`, borderRadius:8, marginTop:4, zIndex:10, maxHeight:160, overflowY:'auto' }}>
                    {memberResults.map(m=>(
                      <div key={m.id} onClick={()=>{setPickedMember(m);setMemberResults([]);}} style={{ padding:'8px 11px', fontSize:12, cursor:'pointer', color:t.text }}>{m.full_name} <span style={{color:t.muted}}>· {m.phone||'—'}</span></div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <input value={visitorName} onChange={e=>setVisitorName(e.target.value)} placeholder="Full name"
                  style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
                <input value={visitorPhone} onChange={e=>setVisitorPhone(e.target.value)} placeholder="Phone"
                  style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
                <input value={visitorPrayer} onChange={e=>setVisitorPrayer(e.target.value)} placeholder="Prayer point (optional)"
                  style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
              </div>
            )}
            {checkinError && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 8 }}>{checkinError}</div>}
            {checkinSuccess && <div style={{ background: t.tealBg, color: t.teal, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 8 }}>{checkinSuccess}</div>}
            <button onClick={checkIn} disabled={checkingIn}
              style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
              {checkingIn ? 'Checking in…' : 'Check in'}
            </button>

            <div style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Broadcast to all registrants</div>
            <textarea rows={3} value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Message to send via SMS to everyone registered..."
              style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
            {broadcastResult && (
              <div style={{ background: broadcastResult.provider_configured ? t.tealBg : t.amberBg, color: broadcastResult.provider_configured ? t.teal : t.amber, borderRadius: 8, padding: '8px 12px', fontSize: 11, marginBottom: 8 }}>
                {broadcastResult.provider_configured
                  ? `Sent to ${broadcastResult.sent}/${broadcastResult.total} registrants (${broadcastResult.failed} failed).`
                  : `No SMS provider configured yet — nothing was actually sent. Set SMS_API_URL/SMS_API_KEY to enable real delivery.`}
              </div>
            )}
            <button onClick={sendBroadcast} disabled={broadcasting || !broadcastMsg.trim() || registrants.length === 0}
              style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !broadcastMsg.trim() || registrants.length === 0 ? 0.5 : 1 }}>
              {broadcasting ? 'Sending…' : `Broadcast to ${registrants.length}`}
            </button>
          </div>
        )}
      </div>
      )}

      {view === 'analytics' && (
        <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Event History &amp; Analytics</div>
          <div style={{ fontSize: 11, color: t.muted, marginBottom: 14 }}>Registration-to-attendance for every program, oldest gaps first — use this to compare a recurring program (e.g. this year&apos;s convention vs last year&apos;s).</div>
          {statsLoading ? (
            <>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</>
          ) : eventStats.length === 0 ? (
            <div style={{ fontSize: 12, color: t.muted }}>No events yet.</div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eventStats.map(ev => (
                <div key={ev.id} style={{ background: t.cardInner || t.input, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 500, fontSize: 12, color: t.text }}>{ev.title}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, color: ev.attendance_rate >= 60 ? t.teal : ev.attendance_rate > 0 ? t.amber : t.muted }}>{ev.registrations > 0 ? `${ev.attendance_rate}%` : '—'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.sub }}>{ev.event_date}{ev.end_date && ev.end_date !== ev.event_date ? ` – ${ev.end_date}` : ''}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{ev.registrations} registered · {ev.expected_headcount} expected · {ev.attended} attended</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                    {['Event', 'Date', 'Registered', 'Expected headcount', 'Attended', 'Attendance rate'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eventStats.map(ev => (
                    <tr key={ev.id} style={{ borderBottom: `0.5px solid ${t.border}` }}>
                      <td style={{ padding: '8px 10px', color: t.text, fontWeight: 500 }}>{ev.title}</td>
                      <td style={{ padding: '8px 10px', color: t.sub }}>{ev.event_date}{ev.end_date && ev.end_date !== ev.event_date ? ` – ${ev.end_date}` : ''}</td>
                      <td style={{ padding: '8px 10px', color: t.text }}>{ev.registrations}</td>
                      <td style={{ padding: '8px 10px', color: t.text }}>{ev.expected_headcount}</td>
                      <td style={{ padding: '8px 10px', color: t.text }}>{ev.attended}</td>
                      <td style={{ padding: '8px 10px', color: ev.attendance_rate >= 60 ? t.teal : ev.attendance_rate > 0 ? t.amber : t.muted, fontWeight: 600 }}>{ev.registrations > 0 ? `${ev.attendance_rate}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
