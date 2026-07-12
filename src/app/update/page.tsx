'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';

type Member = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  cell_name?: string;
  fellowship_name?: string;
  updated?: boolean;
  saving?: boolean;
};

type EditState = {
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
};

export default function UpdatePage() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [editing, setEditing] = useState<Record<string, EditState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [leaderName, setLeaderName] = useState('');
  const [role, setRole] = useState('');
  const [unitName, setUnitName] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete'>('incomplete');
  const [error, setError] = useState('');

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
  };

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) { router.push('/login'); return; }
        setLeaderName(data.name || '');
        setRole(data.role || '');
      })
      .catch(() => router.push('/login'));

    fetch('/api/update/members', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.members) {
          setMembers(data.members);
          setUnitName(data.unit_name || '');
          // Init edit state for each member
          const initEdit: Record<string, EditState> = {};
          data.members.forEach((m: Member) => {
            initEdit[m.id] = {
              full_name: m.full_name || '',
              phone: m.phone || '',
              email: m.email || '',
              date_of_birth: m.date_of_birth || '',
              gender: m.gender || '',
            };
          });
          setEditing(initEdit);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  function isIncomplete(m: Member) {
    return !m.phone || !m.date_of_birth || !m.gender || !m.full_name.includes(' ');
  }

  async function saveMember(id: string) {
    const edit = editing[id];
    if (!edit) return;
    setSaving(prev => ({ ...prev, [id]: true }));
    setError('');
    try {
      const res = await fetch(`/api/update/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(edit),
      });
      if (res.ok) {
        setSaved(prev => ({ ...prev, [id]: true }));
        setMembers(prev => prev.map(m => m.id === id ? { ...m, ...edit } : m));
        setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 3000);
      } else {
        const json = await res.json();
        setError(json.error?.message || 'Failed to save. Please try again.');
      }
    } catch { setError('Network error. Please try again.'); }
    setSaving(prev => ({ ...prev, [id]: false }));
  }

  function updateEdit(id: string, field: keyof EditState, value: string) {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    document.cookie = 'shepherd_token=; Max-Age=0; path=/';
    router.push('/login');
  }

  const filteredMembers = members.filter(m => {
    const matchSearch = search ? m.full_name.toLowerCase().includes(search.toLowerCase()) : true;
    const matchFilter = filter === 'incomplete' ? isIncomplete(m) : true;
    return matchSearch && matchFilter;
  });

  const incompleteCount = members.filter(isIncomplete).length;
  const completeCount = members.length - incompleteCount;

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
            <div style={{ fontSize: 10, color: t.muted }}>Member Records Update{unitName ? ` · ${unitName}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell dark={dark} />
          <div onClick={() => setDark(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>
            {dark ? '☀' : '◑'}
          </div>
          <button onClick={logout} style={{ background: 'transparent', color: t.muted, border: 'none', fontSize: 12, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>
            Member records housecleaning
          </div>
          <div style={{ fontSize: 12, color: t.sub, lineHeight: 1.6 }}>
            Please update missing information for your members. This helps the pastor's dashboard stay accurate and ensures birthday alerts and follow-up communications reach the right people. This form closes in 14 days.
          </div>
        </div>

        {/* Progress */}
        <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>Completion progress</span>
            <span style={{ fontSize: 12, color: t.purple, fontWeight: 600 }}>{completeCount}/{members.length} complete</span>
          </div>
          <div style={{ height: 6, background: t.input, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${members.length > 0 ? (completeCount / members.length) * 100 : 0}%`, background: '#534AB7', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: t.teal }}>{completeCount} complete</span>
            <span style={{ fontSize: 11, color: t.coral }}>{incompleteCount} need attention</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..."
            style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }} />
          <div style={{ display: 'flex', background: t.input, borderRadius: 8, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
            {[{ id: 'incomplete', label: `Incomplete (${incompleteCount})` }, { id: 'all', label: `All (${members.length})` }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as typeof filter)}
                style={{ padding: '8px 14px', border: 'none', background: filter === f.id ? '#534AB7' : 'transparent', color: filter === f.id ? '#fff' : t.sub, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: filter === f.id ? 600 : 400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: t.coralBg, borderRadius: 9, border: `0.5px solid rgba(216,90,48,0.3)`, padding: '10px 14px', fontSize: 12, color: t.coral, marginBottom: 14 }}>{error}</div>
        )}

        {/* Member cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.muted, fontSize: 13 }}>Loading members...</div>
        ) : filteredMembers.length === 0 ? (
          <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: t.sub }}>
              {filter === 'incomplete' ? 'All records are complete! Great work.' : 'No members found.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredMembers.map(m => {
              const edit = editing[m.id];
              if (!edit) return null;
              const incomplete = isIncomplete(m);
              const isSaving = saving[m.id];
              const isSaved = saved[m.id];

              return (
                <div key={m.id} style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${incomplete ? 'rgba(216,90,48,0.3)' : t.border}`, padding: '16px 18px', borderLeft: `3px solid ${incomplete ? t.coral : t.teal}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{m.full_name}</div>
                      <div style={{ fontSize: 10, color: t.muted, marginTop: 2 }}>{m.cell_name || m.fellowship_name || ''}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: incomplete ? t.coralBg : t.tealBg, color: incomplete ? t.coral : t.teal, fontWeight: 500 }}>
                      {incomplete ? 'Incomplete' : 'Complete'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Full name</div>
                      <input value={edit.full_name} onChange={e => updateEdit(m.id, 'full_name', e.target.value)}
                        placeholder="First and last name"
                        style={{ width: '100%', border: `0.5px solid ${!edit.full_name.includes(' ') ? 'rgba(216,90,48,0.4)' : t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                      {!edit.full_name.includes(' ') && <div style={{ fontSize: 10, color: t.coral, marginTop: 2 }}>Include first and last name</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Phone number</div>
                      <input value={edit.phone} onChange={e => updateEdit(m.id, 'phone', e.target.value)}
                        placeholder="08012345678"
                        style={{ width: '100%', border: `0.5px solid ${!edit.phone ? 'rgba(216,90,48,0.4)' : t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Date of birth</div>
                      <input type="date" value={edit.date_of_birth} onChange={e => updateEdit(m.id, 'date_of_birth', e.target.value)}
                        style={{ width: '100%', border: `0.5px solid ${!edit.date_of_birth ? 'rgba(216,90,48,0.4)' : t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Gender</div>
                      <select value={edit.gender} onChange={e => updateEdit(m.id, 'gender', e.target.value)}
                        style={{ width: '100%', border: `0.5px solid ${!edit.gender ? 'rgba(216,90,48,0.4)' : t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none' }}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Email (optional)</div>
                      <input value={edit.email} onChange={e => updateEdit(m.id, 'email', e.target.value)}
                        placeholder="member@email.com"
                        style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => saveMember(m.id)} disabled={isSaving}
                      style={{ background: isSaved ? '#1D9E75' : '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: isSaving ? 'wait' : 'pointer', opacity: isSaving ? 0.7 : 1, transition: 'background 0.2s' }}>
                      {isSaving ? 'Saving...' : isSaved ? '✓ Saved' : 'Save changes'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
