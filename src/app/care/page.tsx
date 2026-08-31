'use client';
import { useTheme } from '@/hooks/useTheme';
import { useHeaderVisibility } from '@/hooks/useHeaderVisibility';
import NotificationBell from "@/components/NotificationBell";
import MyAccountButton from "@/components/MyAccountButton";
import CareOverview from '@/components/CareOverview';
import BirthdayPanel from '@/components/BirthdayPanel';
import BirthdayBanner from '@/components/BirthdayBanner';
import CareEventsTab from '@/components/CareEventsTab';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChatNavButton from '@/components/ChatNavButton';
import LoadingScreen from '@/components/LoadingScreen';
import ThemeToggle from '@/components/ThemeToggle';
import GuideTour, { useFirstVisitGuide } from '@/components/GuideTour';
import GuideHelpPanel from '@/components/GuideHelpPanel';
import Icon from '@/components/Icon';
import { useChurchConfigStandalone } from '@/hooks/useChurchConfig';

type Lead = {
  id: string;
  member_name: string;
  member_phone: string;
  cell_name: string;
  fellowship: string;
  weeks_absent: number;
  trigger_date: string;
  assigned_to: string;
  status: 'new' | 'in_progress' | 'reached' | 'visited' | 'restored' | 'unreachable' | 'closed';
  contact_attempts: number;
  last_contact?: string;
  notes?: string;
  outcome?: string;
  sla_grade?: string;
};

type FirstTimer = {
  id: string;
  full_name: string;
  phone: string;
  how_they_came: string;
  service_date: string;
  assigned_to?: string;
  status: 'new' | 'contacted' | 'follow_up' | 'converted' | 'declined';
  notes?: string;
  address?: string;
  occupation?: string;
  date_of_birth?: string;
  would_join?: string;
  volunteer_interest?: string;
  prayer_point?: string;
  cell_id?: string;
  completed_member_class?: boolean;
  outcome?: string;
  sla_grade?: string;
};

type NavTab = 'queue' | 'first_timers' | 'history' | 'birthdays' | 'events';

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  new:          { bg: '#EEEDFE', text: '#3C3489', label: 'New' },
  in_progress:  { bg: '#FAEEDA', text: '#633806', label: 'In progress' },
  reached:      { bg: '#E1F5EE', text: '#085041', label: 'Reached' },
  visited:      { bg: '#E1F5EE', text: '#085041', label: 'Visited' },
  restored:     { bg: '#E1F5EE', text: '#085041', label: 'Restored' },
  unreachable:  { bg: '#FAECE7', text: '#993C1D', label: 'Unreachable' },
  closed:       { bg: '#F3F4F6', text: '#6B7280', label: 'Closed' },
  contacted:    { bg: '#FAEEDA', text: '#633806', label: 'Contacted' },
  follow_up:    { bg: '#EEEDFE', text: '#3C3489', label: 'Follow-up' },
  converted:    { bg: '#E1F5EE', text: '#085041', label: 'Converted' },
  declined:     { bg: '#FAECE7', text: '#993C1D', label: 'Declined' },
};

const OUTCOMES = [
  { value: 'in_progress', label: 'In progress — still reaching out' },
  { value: 'reached', label: 'Reached — phone contact made' },
  { value: 'visited', label: 'Visited — in-person visit done' },
  { value: 'restored', label: 'Restored — returning to church' },
  { value: 'unreachable', label: 'Unreachable — no response after 3 attempts' },
  { value: 'closed', label: 'Close lead — no longer relevant' },
];

const FIRST_TIMER_OUTCOMES = [
  { value: 'contacted', label: 'Contacted — phone call made' },
  { value: 'follow_up', label: 'Follow-up scheduled' },
  { value: 'converted', label: 'Joined the church' },
  { value: 'declined', label: 'Not interested' },
];

const HOW_THEY_CAME = [
  { value: 'altar_call', label: 'Altar call' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'invited', label: 'Invited by member' },
  { value: 'online', label: 'Online / Social media' },
  { value: 'crusade', label: 'Crusade / Outreach' },
  { value: 'referral', label: 'Referral' },
];

export default function CareTeamPage() {
  const router = useRouter();
  const [tab, setTab] = useState<NavTab>('queue');
  const {dark, setDark} = useTheme();
  const { config: churchConfig } = useChurchConfigStandalone();
  const [tourOpen, setTourOpen] = useFirstVisitGuide('care');
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
  const [leaderName, setLeaderName] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [firstTimers, setFirstTimers] = useState<FirstTimer[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedTimer, setSelectedTimer] = useState<FirstTimer | null>(null);
  const [updateForm, setUpdateForm] = useState({ status: '', notes: '' });
  const [timerForm, setTimerForm] = useState({ status: '', notes: '' });
  const [newTimerForm, setNewTimerForm] = useState({ full_name: '', phone: '', how_they_came: '', notes: '', address: '', occupation: '', date_of_birth: '', would_join: '', volunteer_interest: '', prayer_point: '' });
  const [showNewTimer, setShowNewTimer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState('');

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
    chartGrid: dark ? 'rgba(168,159,255,0.06)' : '#F0EEF9', chartAxis: dark ? 'rgba(168,159,255,0.35)' : '#9990CC', chartTip: dark ? '#13102A' : '#FFFFFF', chartTipText: dark ? '#E8E5FF' : '#1A1040',
  };

  const card = (e?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`,
    borderRadius: 12, padding: '16px 18px', ...e,
  });

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        setLeaderName(data.name || '');
        setPageReady(true);
      })
      .catch(() => router.push('/login'));

    fetchLeads();
    fetchFirstTimers();
  }, [router]);

  function fetchLeads() {
    fetch('/api/care/leads', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.leads) setLeads(data.leads); })
      .catch(() => {});
  }

  function fetchFirstTimers() {
    fetch('/api/care/first-timers', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.first_timers) setFirstTimers(data.first_timers); })
      .catch(() => {});
  }

  async function updateLead() {
    if (!selectedLead || !updateForm.status) return;
    setSaving(true);
    setActionError('');
    try {
      const res = await fetch(`/api/care/leads/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: updateForm.status, notes: updateForm.notes }),
      });
      if (res.ok) {
        setSuccess('Lead updated successfully');
        setSelectedLead(null);
        setUpdateForm({ status: '', notes: '' });
        fetchLeads();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const json = await res.json().catch(() => ({}));
        setActionError(json?.error?.message || 'Failed to update lead.');
      }
    } catch { setActionError('Network error — lead was not updated.'); }
    setSaving(false);
  }

  async function updateFirstTimer() {
    if (!selectedTimer || !timerForm.status) return;
    setSaving(true);
    setActionError('');
    try {
      const res = await fetch(`/api/care/first-timers/${selectedTimer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: timerForm.status, notes: timerForm.notes }),
      });
      if (res.ok) {
        setSuccess('First timer updated');
        setSelectedTimer(null);
        setTimerForm({ status: '', notes: '' });
        fetchFirstTimers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const json = await res.json().catch(() => ({}));
        setActionError(json?.error?.message || 'Failed to update first timer.');
      }
    } catch { setActionError('Network error — first timer was not updated.'); }
    setSaving(false);
  }

  async function addFirstTimer() {
    if (!newTimerForm.full_name || !newTimerForm.phone) return;
    setSaving(true);
    setActionError('');
    try {
      const res = await fetch('/api/care/first-timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newTimerForm,
          service_date: new Date().toISOString().split('T')[0],
        }),
      });
      if (res.ok) {
        setSuccess('First timer added');
        setShowNewTimer(false);
        setNewTimerForm({ full_name: '', phone: '', how_they_came: '', notes: '', address: '', occupation: '', date_of_birth: '', would_join: '', volunteer_interest: '', prayer_point: '' });
        fetchFirstTimers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const json = await res.json().catch(() => ({}));
        setActionError(json?.error?.message || 'Failed to add first timer.');
      }
    } catch { setActionError('Network error — first timer was not added.'); }
    setSaving(false);
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  const activeLeads = leads.filter(l => !['closed', 'restored'].includes(l.status));
  const urgentLeads = leads.filter(l => l.weeks_absent >= 3 && !['closed', 'restored'].includes(l.status));
  const newTimers = firstTimers.filter(f => f.status === 'new');

  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: 'ti-layout-dashboard' },
    { id: 'queue' as NavTab, label: `Absence queue${activeLeads.length > 0 ? ` (${activeLeads.length})` : ''}` },
    { id: 'first_timers' as NavTab, label: `First timers${newTimers.length > 0 ? ` (${newTimers.length})` : ''}` },
    { id: 'history' as NavTab, label: 'History', icon: 'ti-history' },
    { id: 'birthdays' as NavTab, label: 'Birthdays', icon: 'ti-cake' },
    { id: 'events' as NavTab, label: 'Events', icon: 'ti-calendar-event' },
  ];

  if (!pageReady) return <LoadingScreen dark={dark} label="Loading care & follow-up…" />;

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
              <div style={{ fontSize: 10, color: t.muted }}>Follow-Up & Care{leaderName ? ` · ${leaderName}` : ''}</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Care</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 8, flexShrink: 0 }}>
          {urgentLeads.length > 0 && (
            <div style={{ background: t.coralBg, border: `0.5px solid rgba(216,90,48,0.2)`, borderRadius: 20, padding: isMobile ? '3px 7px' : '3px 10px', fontSize: 11, color: t.coral, fontWeight: 500 }}>
              {urgentLeads.length}{!isMobile && ' urgent'}
            </div>
          )}
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

      <BirthdayBanner isMobile={isMobile} />

      {/* Sub-nav */}
      <div style={{ background: t.navBg, borderBottom: `0.5px solid ${t.navBorder}`, padding: '10px 20px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            onMouseEnter={e => { if (tab !== n.id) e.currentTarget.style.background = t.purpleBg; }}
            onMouseLeave={e => { if (tab !== n.id) e.currentTarget.style.background = 'transparent'; }}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 20, background: tab === n.id ? '#534AB7' : 'transparent', fontSize: 12, fontWeight: tab === n.id ? 600 : 500, color: tab === n.id ? '#fff' : t.muted, cursor: 'pointer', transition: 'all var(--motion-fast) var(--ease-out-expo)', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

        {/* Success banner */}
        {success && (
          <div style={{ background: t.tealBg, border: `0.5px solid rgba(29,158,117,0.2)`, borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: t.teal, fontWeight: 500 }}>
            {success}
          </div>
        )}
        {actionError && (
          <div style={{ background: t.coralBg, border: `0.5px solid rgba(216,90,48,0.25)`, borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: t.coral, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span>{actionError}</span>
            <button onClick={() => setActionError('')} style={{ background: 'transparent', border: 'none', color: t.coral, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
          </div>
        )}

        {tab === 'overview' && (
          <CareOverview dark={dark} t={t} isMobile={isMobile} />
        )}

        {/* ── ABSENCE QUEUE ── */}
        {tab === 'queue' && (
          <div>
            {selectedLead ? (
              <div>
                <button onClick={() => { setSelectedLead(null); setUpdateForm({ status: '', notes: '' }); }}
                  style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 16, fontWeight: 500 }}>
                  ← Back to queue
                </button>
                <div style={card({ marginBottom: 14 })}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>{selectedLead.member_name}</div>
                  <div style={{ fontSize: 12, color: t.sub, marginBottom: 16 }}>{selectedLead.cell_name} · {selectedLead.fellowship} {churchConfig.tier1_label || 'Fellowship'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Weeks absent', value: selectedLead.weeks_absent, color: selectedLead.weeks_absent >= 3 ? t.coral : t.amber, bg: selectedLead.weeks_absent >= 3 ? t.coralBg : t.amberBg },
                      { label: 'Contact attempts', value: selectedLead.contact_attempts, color: t.purple, bg: t.purpleBg },
                      // tel: href on this one tile only — a one-tap call
                      // instead of copying the number out and switching
                      // apps, and the care team often has no other saved
                      // contact for this member at all.
                      { label: 'Phone', value: selectedLead.member_phone, color: t.teal, bg: t.tealBg, href: selectedLead.member_phone ? `tel:${selectedLead.member_phone}` : undefined },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 12px' }}>
                        {s.href ? (
                          <a href={s.href} style={{ fontSize: 14, fontWeight: 700, color: s.color, textDecoration: 'none', display: 'block' }}>{s.value}</a>
                        ) : (
                          <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                        )}
                        <div style={{ fontSize: 10, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* SLA notice */}
                  <div style={{ background: t.purpleBg, borderRadius: 8, padding: '10px 13px', marginBottom: 16, fontSize: 11, color: t.purple }}>
                    <strong>SLA:</strong> First contact by Wednesday · Monday = A+ · Tuesday = A · Wednesday = B · Thursday = C · Friday = D · Saturday = F
                  </div>

                  {selectedLead.notes && (
                    <div style={{ background: t.input, borderRadius: 8, padding: '10px 13px', marginBottom: 16, fontSize: 12, color: t.sub }}>
                      <strong style={{ color: t.text }}>Previous notes:</strong> {selectedLead.notes}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Update outcome</div>
                    <select value={updateForm.status} onChange={e => setUpdateForm(p => ({ ...p, status: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', marginBottom: 10 }}>
                      <option value="">Select outcome</option>
                      {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <textarea value={updateForm.notes} onChange={e => setUpdateForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Add notes about this contact attempt..."
                      rows={3}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <button onClick={updateLead} disabled={saving || !updateForm.status}
                    style={{ width: '100%', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving || !updateForm.status ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : 'Save update'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Active leads', value: activeLeads.length, accent: '#534AB7' },
                    { label: 'Urgent (3+ weeks)', value: urgentLeads.length, accent: '#D85A30' },
                    { label: 'Restored this month', value: leads.filter(l => l.status === 'restored').length, accent: '#1D9E75' },
                  ].map(k => (
                    <div key={k.label} style={{ ...card({ padding: '12px 14px' }), borderTop: `2.5px solid ${k.accent}` }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{k.value}</div>
                      <div style={{ fontSize: 10, color: t.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Lead list */}
                {leads.length === 0 ? (
                  <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 14, color: t.text, marginBottom: 6 }}>No active leads</div>
                    <div style={{ fontSize: 12, color: t.muted }}>Absence alerts will appear here automatically when members miss a Sunday.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {leads.filter(l => !['closed'].includes(l.status)).map(lead => {
                      const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                      const isUrgent = lead.weeks_absent >= 3;
                      return (
                        <div key={lead.id} onClick={() => { setSelectedLead(lead); setUpdateForm({ status: lead.status, notes: '' }); }}
                          style={{ ...card({ padding: '14px 16px' }), cursor: 'pointer', borderLeft: `3px solid ${isUrgent ? '#D85A30' : lead.weeks_absent >= 2 ? '#BA7517' : '#534AB7'}` }}
                          onMouseEnter={e => e.currentTarget.style.background = dark ? '#1A1635' : '#F7F6FF'}
                          onMouseLeave={e => e.currentTarget.style.background = t.card}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{lead.member_name}</div>
                              <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{lead.cell_name} · {lead.fellowship}</div>
                            </div>
                            <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: cfg.bg, color: cfg.text, fontWeight: 500, flexShrink: 0 }}>{cfg.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                            <span style={{ color: isUrgent ? t.coral : t.amber, fontWeight: 500 }}>{lead.weeks_absent} weeks absent</span>
                            <span style={{ color: t.muted }}>{lead.contact_attempts} attempt{lead.contact_attempts !== 1 ? 's' : ''}</span>
                            {lead.member_phone && (
                              <a href={`tel:${lead.member_phone}`} onClick={e => e.stopPropagation()}
                                style={{ color: t.teal, textDecoration: 'none', fontWeight: 500 }}>
                                {lead.member_phone}
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── FIRST TIMERS ── */}
        {tab === 'first_timers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{firstTimers.length} first timers logged</div>
              <button onClick={() => setShowNewTimer(v => !v)}
                style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                + Log first timer
              </button>
            </div>

            {/* New first timer form */}
            {showNewTimer && (
              <div style={{ ...card({ marginBottom: 14 }) }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 14 }}>Log new first timer</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Full name *</div>
                    <input value={newTimerForm.full_name} onChange={e => setNewTimerForm(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="First and last name"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Phone number *</div>
                    <input value={newTimerForm.phone} onChange={e => setNewTimerForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="08012345678"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Address</div>
                    <input value={newTimerForm.address} onChange={e => setNewTimerForm(p => ({ ...p, address: e.target.value }))}
                      placeholder="Home address"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Occupation</div>
                      <input value={newTimerForm.occupation} onChange={e => setNewTimerForm(p => ({ ...p, occupation: e.target.value }))}
                        style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Date of birth</div>
                      <input type="date" value={newTimerForm.date_of_birth} onChange={e => setNewTimerForm(p => ({ ...p, date_of_birth: e.target.value }))}
                        style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>How they came</div>
                    <select value={newTimerForm.how_they_came} onChange={e => setNewTimerForm(p => ({ ...p, how_they_came: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                      <option value="">Select</option>
                      {HOW_THEY_CAME.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Would they join the church?</div>
                    <select value={newTimerForm.would_join} onChange={e => setNewTimerForm(p => ({ ...p, would_join: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="maybe">Maybe</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Interested in volunteering? Where?</div>
                    <input value={newTimerForm.volunteer_interest} onChange={e => setNewTimerForm(p => ({ ...p, volunteer_interest: e.target.value }))}
                      placeholder="e.g. Media, Ushering, Choir..."
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Prayer point</div>
                    <textarea value={newTimerForm.prayer_point} onChange={e => setNewTimerForm(p => ({ ...p, prayer_point: e.target.value }))}
                      placeholder="Goes straight to the prayer team and pastor"
                      rows={2}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Notes from initial conversation</div>
                    <textarea value={newTimerForm.notes} onChange={e => setNewTimerForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Any observations, prayer requests, interests..."
                      rows={2}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addFirstTimer} disabled={saving || !newTimerForm.full_name || !newTimerForm.phone}
                      style={{ flex: 1, background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving || !newTimerForm.full_name ? 0.6 : 1 }}>
                      {saving ? 'Saving...' : 'Save first timer'}
                    </button>
                    <button onClick={() => setShowNewTimer(false)}
                      style={{ background: t.input, color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '10px 16px', fontSize: 12, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* First timer detail */}
            {selectedTimer ? (
              <div>
                <button onClick={() => { setSelectedTimer(null); setTimerForm({ status: '', notes: '' }); }}
                  style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: 14, fontWeight: 500 }}>
                  ← Back
                </button>
                <div style={card()}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>{selectedTimer.full_name}</div>
                  <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>
                    <a href={`tel:${selectedTimer.phone}`} style={{ color: t.teal, textDecoration: 'none', fontWeight: 500 }}>{selectedTimer.phone}</a> · {HOW_THEY_CAME.find(h => h.value === selectedTimer.how_they_came)?.label || selectedTimer.how_they_came}
                  </div>
                  {(selectedTimer.address || selectedTimer.occupation || selectedTimer.would_join || selectedTimer.volunteer_interest) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14, fontSize: 12, color: t.sub }}>
                      {selectedTimer.address && <div>Address: {selectedTimer.address}</div>}
                      {selectedTimer.occupation && <div>Occupation: {selectedTimer.occupation}</div>}
                      {selectedTimer.would_join && <div>Would join: {selectedTimer.would_join}</div>}
                      {selectedTimer.volunteer_interest && <div>Volunteer interest: {selectedTimer.volunteer_interest}</div>}
                    </div>
                  )}
                  {selectedTimer.prayer_point && (
                    <div style={{ background: t.coralBg || '#FAECE7', borderRadius: 8, padding: '10px 13px', marginBottom: 14, fontSize: 12, color: t.text }}>
                      <strong>Prayer point:</strong> {selectedTimer.prayer_point}
                    </div>
                  )}
                  {selectedTimer.notes && (
                    <div style={{ background: t.input, borderRadius: 8, padding: '10px 13px', marginBottom: 14, fontSize: 12, color: t.sub }}>
                      {selectedTimer.notes}
                    </div>
                  )}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Update status</div>
                    <select value={timerForm.status} onChange={e => setTimerForm(p => ({ ...p, status: e.target.value }))}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', marginBottom: 10 }}>
                      <option value="">Select outcome</option>
                      {FIRST_TIMER_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <textarea value={timerForm.notes} onChange={e => setTimerForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Notes from this contact..."
                      rows={3}
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  </div>
                  <button onClick={updateFirstTimer} disabled={saving || !timerForm.status}
                    style={{ width: '100%', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving || !timerForm.status ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : 'Save update'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {firstTimers.length === 0 && !showNewTimer && (
                  <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 14, color: t.text, marginBottom: 6 }}>No first timers logged yet</div>
                    <div style={{ fontSize: 12, color: t.muted }}>Log people who responded to altar call or visited today.</div>
                  </div>
                )}
                {firstTimers.map(ft => {
                  const cfg = STATUS_CONFIG[ft.status] || STATUS_CONFIG.new;
                  return (
                    <div key={ft.id} onClick={() => { setSelectedTimer(ft); setTimerForm({ status: ft.status, notes: '' }); }}
                      style={{ ...card({ padding: '13px 15px' }), cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = dark ? '#1A1635' : '#F7F6FF'}
                      onMouseLeave={e => e.currentTarget.style.background = t.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{ft.full_name}</div>
                          <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                            <a href={`tel:${ft.phone}`} onClick={e => e.stopPropagation()} style={{ color: t.teal, textDecoration: 'none', fontWeight: 500 }}>{ft.phone}</a> · {new Date(ft.service_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: cfg.bg, color: cfg.text, fontWeight: 500 }}>{cfg.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'birthdays' && (
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 0' }}>
            <BirthdayPanel dark={dark} t={t} scope="all" showFellowship={true} />
          </div>
        )}

        {/* ── EVENTS ── */}
        {tab === 'events' && (
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 0' }}>
            <CareEventsTab t={t} isMobile={isMobile} />
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 10, marginBottom: 6 }}>
              {[
                { label: 'Total leads handled', value: leads.length, accent: '#534AB7' },
                { label: 'Restored', value: leads.filter(l => l.status === 'restored').length, accent: '#1D9E75' },
                { label: 'First timers', value: firstTimers.length, accent: '#BA7517' },
              ].map(k => (
                <div key={k.label} style={{ ...card({ padding: '12px 14px' }), borderTop: `2.5px solid ${k.accent}` }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: t.muted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{k.label}</div>
                </div>
              ))}
            </div>
            {leads.filter(l => ['restored', 'closed', 'unreachable'].includes(l.status)).map(lead => {
              const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.closed;
              return (
                <div key={lead.id} style={card({ padding: '13px 15px' })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{lead.member_name}</div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{lead.cell_name} · {lead.weeks_absent} weeks absent</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: cfg.bg, color: cfg.text, fontWeight: 500 }}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
            {leads.filter(l => ['restored', 'closed', 'unreachable'].includes(l.status)).length === 0 && (
              <div style={{ ...card(), textAlign: 'center', padding: 32, color: t.muted, fontSize: 13 }}>No closed leads yet. History builds as you resolve leads.</div>
            )}
          </div>
        )}
      </div>
      <GuideTour portalKey="care" t={t} open={tourOpen} onClose={() => setTourOpen(false)} />
      {helpOpen && (
        <GuideHelpPanel portalKey="care" t={t} onClose={() => setHelpOpen(false)} onReplayTour={() => { setHelpOpen(false); setTourOpen(true); }} />
      )}
    </div>
  );
}
