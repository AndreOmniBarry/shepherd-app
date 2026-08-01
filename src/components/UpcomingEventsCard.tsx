'use client';
import { useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import { SkeletonRow } from '@/components/Skeleton';

type EventRow = { id: string; title: string; event_type: string; event_date: string; end_date: string | null; start_time: string | null; location: string | null; registration_count: number; registration_open: boolean };

export default function UpcomingEventsCard({ t }: { t: Record<string, string> }) {
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    fetch('/api/events?upcoming=true', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => setEvents(data?.events || []))
      .catch(() => setEvents([]));
  }, []);

  if (events && events.length === 0) return null;

  return (
    <div style={{ background: t.card, borderRadius: 12, border: `0.5px solid ${t.border}`, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="ti-calendar-event" size={12} /> Upcoming church events
      </div>
      {events === null ? (
        <>{[0, 1].map(i => <SkeletonRow key={i} />)}</>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.slice(0, 5).map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: t.cardInner || t.input, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{e.title}</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                  {new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {e.end_date && e.end_date !== e.event_date ? ` – ${new Date(e.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                  {e.location ? ` · ${e.location}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 11, color: t.purple || t.text, fontWeight: 500, whiteSpace: 'nowrap' }}>{e.registration_count} registered</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
