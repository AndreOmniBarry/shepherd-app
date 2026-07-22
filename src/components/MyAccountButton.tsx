'use client';
import { useState, useEffect, useRef } from 'react';

interface Props { dark?: boolean; }

const ADMIN_ROLES = ['overseer', 'pa', 'lead_tech'];
const PREVIEW_ROLES: { value: string; label: string; refKind: 'cell' | 'fellowship' | 'department' | null }[] = [
  { value: 'cell_leader', label: 'Cell Leader', refKind: 'cell' },
  { value: 'fellowship_head', label: 'Fellowship Head', refKind: 'fellowship' },
  { value: 'department_head', label: 'Department Head', refKind: 'department' },
  { value: 'care_team', label: 'Care Team', refKind: null },
  { value: 'accounts', label: 'Accounts', refKind: null },
  { value: 'partnership', label: 'Partnership', refKind: null },
];

export default function MyAccountButton({ dark = false }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [previewRole, setPreviewRole] = useState('');
  const [refOptions, setRefOptions] = useState<{ id: string; name: string }[]>([]);
  const [refId, setRefId] = useState('');
  const [starting, setStarting] = useState(false);
  const [exiting, setExiting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const t = {
    card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.12)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040',
    sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC',
    input: dark ? 'rgba(255,255,255,0.05)' : '#F7F6FF',
    purple: dark ? '#A89FFF' : '#534AB7',
    purpleBg: dark ? 'rgba(83,74,183,0.25)' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75',
    tealBg: dark ? 'rgba(29,158,117,0.15)' : '#E1F5EE',
    coral: dark ? '#F87171' : '#D85A30',
    coralBg: dark ? 'rgba(216,90,48,0.15)' : '#FAECE7',
  };

  useEffect(() => {
    if (!open) return;
    fetch('/api/profile', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      if (data?.profile) { setName(data.profile.full_name || ''); setEmail(data.profile.email || ''); setRole(data.profile.role || ''); }
      setImpersonating(!!data?.impersonating);
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    const cfg = PREVIEW_ROLES.find(r => r.value === previewRole);
    setRefId('');
    setRefOptions([]);
    if (!cfg?.refKind) return;
    const endpoint = cfg.refKind === 'cell' ? '/api/cells/all' : cfg.refKind === 'fellowship' ? '/api/fellowships/all' : '/api/departments/all';
    fetch(endpoint, { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      if (cfg.refKind === 'cell' && data?.cells) setRefOptions(data.cells.map((c: { id: string; cell: string; fel: string }) => ({ id: c.id, name: `${c.cell} (${c.fel})` })));
      else if (cfg.refKind === 'fellowship' && data?.fellowships) setRefOptions(data.fellowships.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
      else if (cfg.refKind === 'department' && data?.departments) setRefOptions(data.departments.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
    }).catch(() => {});
  }, [previewRole]);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const inp: React.CSSProperties = { width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
  const label: React.CSSProperties = { fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5, fontWeight: 600 };

  async function saveName() {
    if (!name.trim()) { setMsg({ text: 'Name cannot be empty', error: true }); return; }
    setSavingName(true);
    try {
      const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ full_name: name.trim() }) });
      const d = await r.json();
      if (r.ok) { setMsg({ text: 'Name updated' }); } else { setMsg({ text: d?.error?.message || 'Failed to update name', error: true }); }
    } catch { setMsg({ text: 'Network error', error: true }); }
    setSavingName(false);
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) { setMsg({ text: 'Fill in both password fields', error: true }); return; }
    if (newPassword !== confirmPassword) { setMsg({ text: 'New passwords do not match', error: true }); return; }
    if (newPassword.length < 8) { setMsg({ text: 'New password must be at least 8 characters', error: true }); return; }
    setSavingPassword(true);
    try {
      const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      const d = await r.json();
      if (r.ok) { setMsg({ text: 'Password changed' }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
      else { setMsg({ text: d?.error?.message || 'Failed to change password', error: true }); }
    } catch { setMsg({ text: 'Network error', error: true }); }
    setSavingPassword(false);
  }

  async function startPreview() {
    const cfg = PREVIEW_ROLES.find(r => r.value === previewRole);
    if (!cfg) { setMsg({ text: 'Choose a role to preview', error: true }); return; }
    if (cfg.refKind && !refId) { setMsg({ text: `Choose a ${cfg.refKind} to preview`, error: true }); return; }
    setStarting(true);
    try {
      const refName = refOptions.find(o => o.id === refId)?.name;
      const r = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ role: previewRole, ref_id: refId || undefined, ref_name: refName }) });
      const d = await r.json();
      if (r.ok && d?.data?.path) window.location.href = d.data.path;
      else setMsg({ text: d?.error?.message || 'Failed to start preview', error: true });
    } catch { setMsg({ text: 'Network error', error: true }); }
    setStarting(false);
  }

  async function exitPreview() {
    setExiting(true);
    try {
      const r = await fetch('/api/admin/exit-impersonation', { method: 'POST', credentials: 'include' });
      if (r.ok) window.location.href = '/dashboard';
      else { const d = await r.json(); setMsg({ text: d?.error?.message || 'Failed to exit preview', error: true }); }
    } catch { setMsg({ text: 'Network error', error: true }); }
    setExiting(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(v => !v); setMsg(null); }}
        title="My account"
        style={{ width: 34, height: 34, borderRadius: 9, border: `0.5px solid ${impersonating ? t.coral : t.border}`, background: impersonating ? t.coralBg : (open ? (dark ? 'rgba(83,74,183,0.3)' : '#EEEDFE') : 'transparent'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={impersonating ? t.coral : (dark ? '#A89FFF' : '#534AB7')} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7" />
        </svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 42, width: 320, background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 14, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(83,74,183,0.12)', zIndex: 100, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>My account</div>
          <div style={{ fontSize: 11, color: t.muted, marginBottom: 14 }}>{email}{role ? ` · ${role.replace('_', ' ')}` : ''}</div>

          {msg && (
            <div style={{ background: msg.error ? t.coralBg : t.tealBg, color: msg.error ? t.coral : t.teal, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 500, marginBottom: 12 }}>
              {msg.text}
            </div>
          )}

          {impersonating ? (
            <div style={{ background: t.coralBg, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.coral, marginBottom: 4 }}>You're previewing a demo portal</div>
              <div style={{ fontSize: 11, color: t.sub, marginBottom: 10 }}>Actions here won't affect any real leader's account.</div>
              <button onClick={exitPreview} disabled={exiting} style={{ width: '100%', background: t.coral, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: exiting ? 0.6 : 1 }}>
                {exiting ? 'Exiting…' : 'Exit preview → back to my account'}
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={label}>Full name</div>
                <input value={name} onChange={e => setName(e.target.value)} style={inp} />
                <button onClick={saveName} disabled={savingName} style={{ marginTop: 8, width: '100%', background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingName ? 0.6 : 1 }}>
                  {savingName ? 'Saving…' : 'Save name'}
                </button>
              </div>

              <div style={{ height: 1, background: t.border, margin: '4px 0 14px' }} />

              <div>
                <div style={label}>Current password</div>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
                <div style={label}>New password</div>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
                <div style={label}>Confirm new password</div>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inp} />
                <button onClick={changePassword} disabled={savingPassword} style={{ marginTop: 8, width: '100%', background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingPassword ? 0.6 : 1 }}>
                  {savingPassword ? 'Changing…' : 'Change password'}
                </button>
              </div>

              {ADMIN_ROLES.includes(role) && (
                <>
                  <div style={{ height: 1, background: t.border, margin: '14px 0' }} />
                  <div>
                    <div style={label}>Preview a portal (no password needed)</div>
                    <select value={previewRole} onChange={e => setPreviewRole(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
                      <option value="">Choose a role…</option>
                      {PREVIEW_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {PREVIEW_ROLES.find(r => r.value === previewRole)?.refKind && (
                      <select value={refId} onChange={e => setRefId(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
                        <option value="">Choose {PREVIEW_ROLES.find(r => r.value === previewRole)?.refKind}…</option>
                        {refOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    )}
                    <button onClick={startPreview} disabled={starting || !previewRole} style={{ width: '100%', background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (starting || !previewRole) ? 0.6 : 1 }}>
                      {starting ? 'Loading…' : 'Preview this portal'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
