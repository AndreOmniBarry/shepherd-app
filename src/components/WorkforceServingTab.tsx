'use client';
import { useState, useEffect } from 'react';
import { SkeletonCard, SkeletonRow } from '@/components/Skeleton';

type RosterEntry = { id?: string; member_id: string; member_name: string; role_title: string; position?: string; confirmed?: boolean };
type Roster = { id: string; service_date: string; service_type: string; published: boolean; entries: RosterEntry[] };
type DeptMember = { id: string; full_name: string; phone: string | null };

function nextSundayStr() {
  const d = new Date();
  const add = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().split('T')[0];
}

export default function WorkforceServingTab({ t }: { t: Record<string, string> }) {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceDate, setServiceDate] = useState(nextSundayStr());
  const [draft, setDraft] = useState<RosterEntry[]>([]);
  const [pickMember, setPickMember] = useState('');
  const [pickRole, setPickRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<{ id: string; link: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  function load() {
    fetch('/api/department/roster', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        setRosters(data?.rosters || []);
        setMembers(data?.members || []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const existing = rosters.find(r => r.service_date === serviceDate);
    setDraft(existing ? existing.entries.map(e => ({ ...e })) : []);
  }, [serviceDate, rosters]);

  function addEntry() {
    if (!pickMember || !pickRole.trim()) return;
    const member = members.find(m => m.id === pickMember);
    if (!member) return;
    setDraft(prev => [...prev, { member_id: member.id, member_name: member.full_name, role_title: pickRole.trim() }]);
    setPickMember(''); setPickRole('');
  }

  function removeEntry(idx: number) {
    setDraft(prev => prev.filter((_, i) => i !== idx));
  }

  async function save(publish: boolean) {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/department/roster', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ service_date: serviceDate, service_type: 'sunday', entries: draft.map(({ member_id, member_name, role_title, position }) => ({ member_id, member_name, role_title, position: position || null })), publish }),
      });
      const json = await res.json();
      if (res.ok) {
        setSuccess(publish ? 'Roster published — assigned members notified.' : 'Roster saved as draft.');
        load();
        setTimeout(() => setSuccess(''), 3000);
      } else setError(json.error?.message || 'Failed to save roster.');
    } catch { setError('Network error — roster was not saved.'); }
    setSaving(false);
  }

  const currentRoster = rosters.find(r => r.service_date === serviceDate);

  async function sendInvite(memberId: string) {
    if (!inviteEmail.trim()) { setInviteError('Enter an email address'); return; }
    setInviteSending(true); setInviteError('');
    try {
      const res = await fetch('/api/department/roster/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ member_id: memberId, email: inviteEmail.trim() }),
      });
      const json = await res.json();
      if (res.ok) { setInviteLink({ id: memberId, link: json.data.invite_link }); setInviteEmail(''); }
      else setInviteError(json.error?.message || 'Failed to send invite');
    } catch { setInviteError('Network error — invite was not sent.'); }
    setInviteSending(false);
  }

  if (loading) return (
    <SkeletonCard>
      {Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}
    </SkeletonCard>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Serving Roster</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>Assign your own department&apos;s members to serving roles for a service date, then publish to notify them.</div>
          </div>
          <input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)}
            style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 11px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
        </div>

        {currentRoster?.published && (
          <div style={{ background: t.tealBg, color: t.teal, borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, marginBottom: 10 }}>Published — members have been notified</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12 }}>
          <select value={pickMember} onChange={e => setPickMember(e.target.value)}
            style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
            <option value="">Select member...</option>
            {members.filter(m => !draft.some(d => d.member_id === m.id)).map(m => (<option key={m.id} value={m.id}>{m.full_name}</option>))}
          </select>
          <input value={pickRole} onChange={e => setPickRole(e.target.value)} placeholder="Role (e.g. Lead vocalist, Usher)"
            style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
          <button onClick={addEntry} disabled={!pickMember || !pickRole.trim()}
            style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !pickMember || !pickRole.trim() ? 0.5 : 1 }}>
            Add
          </button>
        </div>

        {draft.length === 0 ? (
          <div style={{ fontSize: 12, color: t.muted, textAlign: 'center', padding: '16px 0' }}>No one assigned yet for this date.</div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {draft.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < draft.length - 1 ? `0.5px solid ${t.border}` : 'none' }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{e.member_name}</span>
                  <span style={{ fontSize: 11, color: t.muted, marginLeft: 8 }}>{e.role_title}</span>
                  {e.confirmed && <span style={{ fontSize: 10, color: t.teal, marginLeft: 8 }}>Confirmed</span>}
                </div>
                <button onClick={() => removeEntry(i)} style={{ background: 'transparent', border: 'none', color: t.coral, cursor: 'pointer', fontSize: 12 }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ background: t.coralBg, color: t.coral, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {success && <div style={{ background: t.tealBg, color: t.teal, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>{success}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => save(false)} disabled={saving}
            style={{ background: 'transparent', border: `0.5px solid ${t.border}`, color: t.text, borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}>
            Save draft
          </button>
          <button onClick={() => save(true)} disabled={saving || draft.length === 0}
            style={{ background: t.teal, border: 'none', color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: draft.length === 0 ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Publish & notify'}
          </button>
        </div>
      </div>

      <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Recent Rosters</div>
        {rosters.length === 0 ? (
          <div style={{ fontSize: 12, color: t.muted }}>No rosters created yet.</div>
        ) : rosters.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `0.5px solid ${t.border}`, fontSize: 12 }}>
            <span style={{ color: t.text }}>{r.service_date}</span>
            <span style={{ color: t.muted }}>{r.entries.length} assigned</span>
            <span style={{ color: r.published ? t.teal : t.amber, fontWeight: 600 }}>{r.published ? 'Published' : 'Draft'}</span>
          </div>
        ))}
      </div>

      <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Give your team portal access</div>
        <div style={{ fontSize: 11, color: t.muted, marginBottom: 12 }}>Invite a roster member to log in and see their own schedule — they&apos;ll be able to confirm or decline assignments themselves.</div>
        {members.length === 0 ? (
          <div style={{ fontSize: 12, color: t.muted }}>No members on your roster yet.</div>
        ) : members.map(m => (
          <div key={m.id} style={{ padding: '8px 0', borderBottom: `0.5px solid ${t.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: t.text }}>{m.full_name}</span>
              {invitingId !== m.id && (
                <button onClick={() => { setInvitingId(m.id); setInviteEmail(''); setInviteError(''); setInviteLink(null); }}
                  style={{ background: 'transparent', border: `0.5px solid ${t.border}`, color: t.purple, borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  Invite
                </button>
              )}
            </div>
            {invitingId === m.id && (
              <div style={{ marginTop: 8 }}>
                {inviteLink?.id === m.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, color: t.teal }}>Invite created — send this link to {m.full_name.split(' ')[0]}:</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input readOnly value={inviteLink.link} style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 11, background: t.input, color: t.text }} />
                      <button onClick={() => navigator.clipboard.writeText(inviteLink.link)} style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Copy</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="their email address"
                      style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 11, background: t.input, color: t.text, outline: 'none' }} />
                    <button onClick={() => sendInvite(m.id)} disabled={inviteSending}
                      style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {inviteSending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                )}
                {inviteError && <div style={{ fontSize: 11, color: t.coral, marginTop: 6 }}>{inviteError}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
