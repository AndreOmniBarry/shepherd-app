export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });
const ADMIN_ROLES = ['overseer', 'pa', 'lead_tech'];

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event_id, full_name, phone, email, whatsapp, preferred_comms, member_id, attending_days, guest_type, companion_count, expectations } = body;
    if (!event_id || !full_name || !phone) return NextResponse.json({ data: null, error: { message: 'Event, name and phone are required' } }, { status: 400 });

    // Check event exists and registration is open
    const evRes = await fetch(`${SURL}/rest/v1/church_events?id=eq.${event_id}&select=id,title,event_date,end_date,start_time,location,registration_open,capacity,is_free,whatsapp_confirmation,sms_confirmation&limit=1`, { headers: H() });
    const evData = await evRes.json();
    const event = evData?.[0];
    if (!event) return NextResponse.json({ data: null, error: { message: 'Event not found' } }, { status: 404 });
    const lastDay = event.end_date || event.event_date;
    const today = new Date().toISOString().split('T')[0];
    if (!event.registration_open || lastDay < today) return NextResponse.json({ data: null, error: { message: 'Registration is closed for this event' } }, { status: 400 });

    // If multi-day, validate every selected day actually falls in range —
    // never trust the client to only send valid dates.
    let validatedDays: string[] | null = null;
    if (event.end_date && event.end_date > event.event_date) {
      const selected = Array.isArray(attending_days) ? attending_days : [];
      validatedDays = selected.filter((d: string) => d >= event.event_date && d <= event.end_date);
      if (validatedDays.length === 0) return NextResponse.json({ data: null, error: { message: 'Select at least one day you\'ll be attending' } }, { status: 400 });
    }

    // Check capacity
    if (event.capacity) {
      const capRes = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${event_id}&select=count`, { headers: { ...H(), 'Prefer': 'count=exact' } });
      const count = parseInt(capRes.headers.get('content-range')?.split('/')[1] || '0');
      if (count >= event.capacity) return NextResponse.json({ data: null, error: { message: 'This event is fully booked' } }, { status: 400 });
    }

    // Check duplicate
    const dupRes = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${event_id}&phone=eq.${encodeURIComponent(phone)}&limit=1`, { headers: H() });
    const dup = await dupRes.json();
    if (Array.isArray(dup) && dup.length > 0) return NextResponse.json({ data: null, error: { message: 'You are already registered for this event' } }, { status: 400 });

    // Register
    const regRes = await fetch(`${SURL}/rest/v1/event_registrations`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        event_id, full_name, phone, email: email || null, whatsapp: whatsapp || phone, preferred_comms: preferred_comms || 'whatsapp',
        is_member: !!member_id, member_id: member_id || null, payment_status: event.is_free ? 'free' : 'pending', registered_at: new Date().toISOString(),
        attending_days: validatedDays, guest_type: ['member', 'minister', 'guest'].includes(guest_type) ? guest_type : 'member',
        companion_count: Math.max(0, parseInt(companion_count) || 0), expectations: expectations?.trim() || null,
      }),
    });
    const regData = await regRes.json();
    const registration = Array.isArray(regData) ? regData[0] : regData;

    // Determine confirmation channel (WhatsApp first, SMS fallback)
    let confirmationChannel = 'none';
    let confirmationQueued = false;
    if (preferred_comms === 'whatsapp' || preferred_comms === 'both') {
      confirmationChannel = 'whatsapp';
      confirmationQueued = true;
    } else if (preferred_comms === 'sms' || preferred_comms === 'both') {
      confirmationChannel = 'sms';
      confirmationQueued = true;
    }

    // TODO: When WhatsApp/SMS provider configured, trigger message here
    // Template: "Hi {name}, you are registered for {event.title} on {event.event_date} at {event.location}. See you there! — {church_name}"

    return NextResponse.json({
      data: {
        registration,
        confirmation: {
          channel: confirmationChannel,
          queued: confirmationQueued,
          message: confirmationQueued
            ? `Confirmation will be sent via ${confirmationChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to ${phone} once messaging provider is configured.`
            : 'Registration successful. No messaging confirmation configured.',
        },
      },
      error: null,
    }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { message: 'Registration failed' } }, { status: 500 }); }
}

// Read-only visibility for the teams that actually plan around
// registrant numbers — care/follow-up, and whichever department handles
// protocol/ushering (checked by name since it isn't its own role).
async function canViewRegistrants(user: { id: string; role: string } | null): Promise<boolean> {
  if (!user) return false;
  if (ADMIN_ROLES.includes(user.role) || user.role === 'care_team') return true;
  if (user.role === 'department_head') {
    const res = await fetch(`${SURL}/rest/v1/users?id=eq.${user.id}&select=departments(name)`, { headers: H() });
    const data = await res.json();
    const deptName = (data?.[0]?.departments as { name?: string } | null)?.name || '';
    return /protocol|ushering/i.test(deptName);
  }
  return false;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!(await canViewRegistrants(user))) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const event_id = searchParams.get('event_id');
    if (!event_id) return NextResponse.json({ data: null, error: { message: 'event_id required' } }, { status: 400 });
    const res = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${event_id}&order=registered_at.desc&select=id,full_name,phone,whatsapp,email,is_member,preferred_comms,payment_status,attended,registered_at,attending_days,guest_type,companion_count,expectations`, { headers: H() });
    const registrations = await res.json();
    return NextResponse.json({ data: { registrations: Array.isArray(registrations) ? registrations : [] }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

// Mark attendance
export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }
    const { id, attended } = await req.json();
    await fetch(`${SURL}/rest/v1/event_registrations?id=eq.${id}`, { method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify({ attended }) });
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
