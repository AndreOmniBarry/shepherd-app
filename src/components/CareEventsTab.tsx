'use client';
import { useState, useEffect } from 'react';
import { SkeletonCard, SkeletonRow } from '@/components/Skeleton';

type EventRow = { id: string; title: string; event_date: string; location: string; registration_open: boolean; status: string; registration_count: number };
type Registrant = { id: string; full_name: string; phone: string; whatsapp: string; email: string | null; is_member: boolean; preferred_comms: string; payment_status: string; attended: boolean; registered_at: string };

export default function CareEventsTab({ t, isMobile = false }: { t: Record<string, string>; isMobile?: boolean }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    fetch('/api/events', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.events) setEvents(data.events); })
      .finally(() => setLoading(false));
  }, []);

  function openEvent(ev: EventRow) {
    setSelected(ev);
    setRegLoading(true);
    fetch(`/api/events/register?event_id=${ev.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { setRegistrants(data?.registrations || []); })
      .finally(() => setRegLoading(false));
  }

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '16px 18px', ...extra,
  });

  if (loading) return (
    <SkeletonCard>
      {Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)}
    </SkeletonCard>
  );

  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={() => setSelected(null)} style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-start' }}>← Back to events</button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{selected.title}</div>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{selected.event_date} · {selected.location || 'No location set'} · {selected.registration_count} registered</div>
        </div>
        <div style={card()}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 12 }}>Registrants</div>
          {regLoading ? (
            <>{[0, 1].map(i => <SkeletonRow key={i} />)}</>
          ) : registrants.length === 0 ? (
            <div style={{ fontSize: 12, color: t.muted }}>No registrations yet.</div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {registrants.map(r => (
                <div key={r.id} style={{ background: t.cardInner || t.input, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 500, fontSize: 12, color: t.text }}>{r.full_name}</div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, flexShrink: 0, background: r.attended ? t.tealBg : t.amberBg, color: r.attended ? t.teal : t.amber, fontWeight: 500 }}>
                      {r.attended ? 'Attended' : 'Not yet'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: t.sub }}>{r.phone} · {r.is_member ? 'Member' : 'Guest'} · <span style={{ textTransform: 'capitalize' }}>{r.preferred_comms}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${t.border}` }}>
                    {['Name', 'Phone', 'Member?', 'Comms', 'Attended'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: t.muted, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrants.map(r => (
                    <tr key={r.id} style={{ borderBottom: `0.5px solid ${t.border}` }}>
                      <td style={{ padding: '8px 10px', color: t.text, fontWeight: 500 }}>{r.full_name}</td>
                      <td style={{ padding: '8px 10px', color: t.sub }}>{r.phone}</td>
                      <td style={{ padding: '8px 10px', color: t.sub }}>{r.is_member ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '8px 10px', color: t.sub, textTransform: 'capitalize' }}>{r.preferred_comms}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: r.attended ? t.tealBg : t.amberBg, color: r.attended ? t.teal : t.amber, fontWeight: 500 }}>
                          {r.attended ? 'Yes' : 'Not yet'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Events</div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Registration numbers for upcoming and past programs — for capacity and follow-up planning.</div>
      </div>
      <div style={card()}>
        {events.length === 0 ? (
          <div style={{ fontSize: 12, color: t.muted }}>No events yet.</div>
        ) : events.map(ev => (
          <div key={ev.id} onClick={() => openEvent(ev)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `0.5px solid ${t.border}`, cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{ev.title}</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{ev.event_date}{ev.location ? ` · ${ev.location}` : ''}</div>
            </div>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: t.purpleBg, color: t.purple, fontWeight: 600 }}>{ev.registration_count} registered</span>
          </div>
        ))}
      </div>
    </div>
  );
}
