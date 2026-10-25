'use client';
import { useState, useEffect } from 'react';
import { SkeletonCard } from '@/components/Skeleton';

// Volunteer sign-ups from the TCH website (bridge → web_volunteer_interest).
// Department heads see the ones mapped to their department; admins see all.

type Volunteer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  teams: string[];
  team_idea: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

const NEXT_STATUS: { value: string; label: string }[] = [
  { value: 'contacted', label: 'Contacted' },
  { value: 'placed', label: 'Placed' },
  { value: 'declined', label: 'Declined' },
  { value: 'archived', label: 'Archive' },
];

export default function WebVolunteersPanel({ t }: { t: Record<string, string> }) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setError('');
    fetch('/api/bridge/volunteers', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data, error: err }) => {
        if (err) setError(err.message || 'Could not load volunteers');
        setVolunteers(data?.volunteers || []);
      })
      .catch(() => setError('Could not load volunteers'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/bridge/volunteers', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error?.message || 'Could not update'); return; }
      setVolunteers(v => status === 'archived' ? v.filter(x => x.id !== id) : v.map(x => x.id === id ? { ...x, status } : x));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <SkeletonCard />;

  return (
    <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${t.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Volunteers from the website</div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
          {volunteers.length} {volunteers.length === 1 ? 'person' : 'people'} asked to serve
        </div>
      </div>

      {error && <div style={{ padding: '10px 16px', fontSize: 12, color: t.coral }}>{error}</div>}

      {volunteers.length === 0 && !error && (
        <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12, color: t.muted }}>
          No website volunteer sign-ups yet.
        </div>
      )}

      {volunteers.map(v => (
        <div key={v.id} style={{ padding: '12px 16px', borderBottom: `0.5px solid ${t.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{v.full_name}</div>
            <div style={{ fontSize: 10, color: t.muted, whiteSpace: 'nowrap' }}>
              {new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · <span style={{ textTransform: 'capitalize' }}>{v.status}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: t.muted, marginTop: 3 }}>
            {v.phone ? <a href={`tel:${v.phone}`} style={{ color: t.teal, textDecoration: 'none', fontWeight: 500 }}>{v.phone}</a> : null}
            {v.phone && v.email ? ' · ' : null}
            {v.email ? <a href={`mailto:${v.email}`} style={{ color: t.teal, textDecoration: 'none' }}>{v.email}</a> : null}
          </div>
          {v.teams.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {v.teams.map(team => (
                <span key={team} style={{ fontSize: 10, background: t.purpleBg, color: t.purple, borderRadius: 10, padding: '2px 8px' }}>{team}</span>
              ))}
            </div>
          )}
          {v.team_idea && <div style={{ fontSize: 11, color: t.sub, marginTop: 6, whiteSpace: 'pre-wrap' }}>New team idea: {v.team_idea}</div>}
          {v.notes && <div style={{ fontSize: 10, color: t.coral, marginTop: 4 }}>{v.notes}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {NEXT_STATUS.filter(s => s.value !== v.status).map(s => (
              <button key={s.value} disabled={busyId === v.id} onClick={() => setStatus(v.id, s.value)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: `0.5px solid ${t.border}`, background: 'transparent', color: t.muted, cursor: 'pointer', fontFamily: 'inherit', opacity: busyId === v.id ? 0.5 : 1 }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
