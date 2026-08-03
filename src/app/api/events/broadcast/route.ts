export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { sendSMS } from '@/lib/sms';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });
const ADMIN_ROLES = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Broadcasts a message to every registrant of one event via SMS. Best-effort
// per recipient — one bad number doesn't fail the whole batch. Safe to call
// even with no SMS provider configured yet (sendSMS no-ops and reports it).
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }

    const { event_id, message } = await req.json();
    if (!event_id || !message?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'event_id and message are required' } }, { status: 400 });
    }

    const evRes = await fetch(`${SURL}/rest/v1/church_events?id=eq.${event_id}&select=title&limit=1`, { headers: H() });
    const evData = await evRes.json();
    const event = evData?.[0];
    if (!event) return NextResponse.json({ data: null, error: { message: 'Event not found' } }, { status: 404 });

    const regRes = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${event_id}&select=id,full_name,phone`, { headers: H() });
    const registrants = await regRes.json();
    const list = Array.isArray(registrants) ? registrants : [];

    if (list.length === 0) {
      return NextResponse.json({ data: { sent: 0, failed: 0, total: 0 }, error: null });
    }

    const results = await Promise.all(list.map(async (r: { id: string; full_name: string; phone: string | null }) => {
      const outcome = await sendSMS(r.phone || '', message.trim(), user.church_id);
      return { registrant: r.full_name, ...outcome };
    }));

    const sent = results.filter(r => r.sent).length;
    const failed = results.length - sent;

    return NextResponse.json({
      data: { sent, failed, total: results.length, provider_configured: !!process.env.SMS_API_URL, event_title: event.title },
      error: null,
    });
  } catch (err) {
    console.error('[POST /api/events/broadcast]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to broadcast' } }, { status: 500 });
  }
}
