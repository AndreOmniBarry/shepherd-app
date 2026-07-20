'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const C = {
  purple: '#534AB7', purpleBg: '#EEEDFE', purpleDark: '#3C3489',
  teal: '#1D9E75', tealBg: '#E1F5EE',
  coral: '#D85A30', coralBg: '#FAECE7',
  amber: '#BA7517', amberBg: '#FAEEDA',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', white: '#FFFFFF', bg: '#F4F3FB',
};

type Event = {
  id: string; title: string; description: string; event_type: string;
  event_date: string; start_time: string; end_time: string; location: string;
  is_free: boolean; price: number; capacity: number; banner_url: string;
  registration_open: boolean; status: string; registration_count: number;
};

const TYPE_ICONS: Record<string,string> = { programme: '📋', conference: '🎤', vigil: '🕯', concert: '🎶', outreach: '🌍', training: '📚', thanksgiving: '🙏', dedication: '👶', other: '⭐' };

export default function EventPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', whatsapp: '', preferred_comms: 'whatsapp' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'details'|'register'|'done'>('details');

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/events/public?slug=${slug}`)
      .then(r => r.json())
      .then(({ data }) => { if (data?.event) setEvent(data.event); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  async function register() {
    if (!form.full_name.trim() || !form.phone.trim()) { setError('Full name and phone are required'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/events/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, event_id: event!.id }),
      });
      const d = await res.json();
      if (res.ok) {
        setSuccess(d.data?.confirmation?.message || 'Registered successfully!');
        setStep('done');
      } else { setError(d?.error?.message || 'Registration failed'); }
    } catch { setError('Network error. Please try again.'); }
    setSubmitting(false);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 14, color: C.muted }}>Loading event…</div>
    </div>
  );

  if (!event) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Event not found</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>This event may have been removed or the link is incorrect.</div>
      </div>
    </div>
  );

  const isFull = event.capacity ? event.registration_count >= event.capacity : false;
  const canRegister = event.registration_open && !isFull && event.status !== 'cancelled';

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-inter, Inter, sans-serif)' }}>
      {/* Header */}
      <div style={{ background: C.purpleDark, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, background: C.white, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 14, height: 14, background: C.purple, borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.white, letterSpacing: '-0.2px' }}>SHEP.HERD</span>
      </div>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px' }}>
        {/* Banner */}
        {event.banner_url ? (
          <img src={event.banner_url} alt={event.title} style={{ width: '100%', borderRadius: 16, marginBottom: 24, objectFit: 'cover', maxHeight: 280 }} />
        ) : (
          <div style={{ width: '100%', height: 180, borderRadius: 16, marginBottom: 24, background: `linear-gradient(135deg, ${C.purpleDark}, ${C.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>
            {TYPE_ICONS[event.event_type] || '⭐'}
          </div>
        )}

        {step === 'details' && (
          <>
            <div style={{ background: C.white, borderRadius: 16, border: `0.5px solid ${C.border}`, padding: '24px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.3px', marginBottom: 6 }}>{event.title}</div>
                  <span style={{ fontSize: 11, background: C.purpleBg, color: C.purple, borderRadius: 10, padding: '2px 10px', fontWeight: 600, textTransform: 'capitalize' }}>
                    {event.event_type}
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 10, whiteSpace: 'nowrap', background: event.status === 'cancelled' ? C.coralBg : isFull ? C.amberBg : C.tealBg, color: event.status === 'cancelled' ? C.coral : isFull ? C.amber : C.teal }}>
                  {event.status === 'cancelled' ? 'Cancelled' : isFull ? 'Fully booked' : 'Open'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {[
                  { icon: '📅', label: new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
                  ...(event.start_time ? [{ icon: '🕐', label: `${event.start_time}${event.end_time ? ` – ${event.end_time}` : ''}` }] : []),
                  ...(event.location ? [{ icon: '📍', label: event.location }] : []),
                  { icon: '🎟', label: event.is_free ? 'Free entry' : `₦${Number(event.price).toLocaleString('en-NG')}` },
                  ...(event.capacity ? [{ icon: '👥', label: `${event.registration_count} registered${event.capacity ? ` / ${event.capacity} capacity` : ''}` }] : []),
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.sub }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              {event.description && (
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, borderTop: `0.5px solid ${C.border}`, paddingTop: 16 }}>{event.description}</div>
              )}
            </div>

            {canRegister && (
              <button onClick={() => setStep('register')}
                style={{ width: '100%', background: C.purple, color: C.white, border: 'none', borderRadius: 12, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Register for this event →
              </button>
            )}
            {!canRegister && event.status !== 'cancelled' && (
              <div style={{ background: C.amberBg, border: `0.5px solid rgba(186,117,23,0.2)`, borderRadius: 12, padding: '14px 18px', textAlign: 'center', fontSize: 13, color: C.amber, fontWeight: 500 }}>
                {isFull ? 'This event is fully booked.' : 'Registration is currently closed.'}
              </div>
            )}
          </>
        )}

        {step === 'register' && (
          <div style={{ background: C.white, borderRadius: 16, border: `0.5px solid ${C.border}`, padding: '24px' }}>
            <button onClick={() => setStep('details')} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← Back</button>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Register for {event.title}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>{new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>

            {error && <div style={{ background: C.coralBg, color: C.coral, borderRadius: 9, padding: '10px 14px', fontSize: 13, marginBottom: 14, fontWeight: 500 }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[{ key: 'full_name', label: 'Full name *', placeholder: 'First and last name', type: 'text' }, { key: 'phone', label: 'Phone number *', placeholder: '08012345678', type: 'tel' }, { key: 'email', label: 'Email (optional)', placeholder: 'your@email.com', type: 'email' }].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>{f.label}</div>
                  <input type={f.type} value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }} />
                </div>
              ))}

              <div>
                <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>Preferred confirmation method</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: 'whatsapp', label: '📱 WhatsApp' }, { val: 'sms', label: '💬 SMS' }, { val: 'both', label: '📱+💬 Both' }, { val: 'none', label: 'None' }].map(opt => (
                    <button key={opt.val} onClick={() => setForm(p => ({ ...p, preferred_comms: opt.val }))}
                      style={{ flex: 1, padding: '9px 6px', borderRadius: 9, border: `1px solid ${form.preferred_comms === opt.val ? C.purple : C.border}`, background: form.preferred_comms === opt.val ? C.purpleBg : C.bg, fontSize: 11, fontWeight: form.preferred_comms === opt.val ? 600 : 400, color: form.preferred_comms === opt.val ? C.purple : C.sub, cursor: 'pointer' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {(form.preferred_comms === 'whatsapp' || form.preferred_comms === 'both') && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 }}>WhatsApp number (if different from phone)</div>
                    <input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                      placeholder={form.phone || '08012345678'}
                      style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} />
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Leave blank to use your phone number above</div>
                  </div>
                )}
              </div>

              <button onClick={register} disabled={submitting || !form.full_name.trim() || !form.phone.trim()}
                style={{ width: '100%', background: C.purple, color: C.white, border: 'none', borderRadius: 11, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: submitting || !form.full_name.trim() || !form.phone.trim() ? 0.7 : 1 }}>
                {submitting ? 'Submitting…' : event.is_free ? 'Complete registration' : `Pay ₦${Number(event.price).toLocaleString('en-NG')} & Register`}
              </button>

              {!event.is_free && (
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'center' as const }}>Paystack payment integration coming soon. Registration confirmed for now.</div>
              )}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ background: C.white, borderRadius: 16, border: `0.5px solid ${C.border}`, padding: '40px 24px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>You're registered!</div>
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: 20 }}>{success}</div>
            <div style={{ background: C.purpleBg, borderRadius: 10, padding: '14px', fontSize: 13, color: C.purple, fontWeight: 500 }}>
              {event.title} · {new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {event.location && ` · ${event.location}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
