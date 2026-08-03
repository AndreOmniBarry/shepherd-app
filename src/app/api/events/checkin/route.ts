export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { assignToLeastLoadedCareTeamMember } from '@/lib/care-assignment';

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

// Records who actually showed up to a special event (vigil, conference,
// convention) — not just who pre-registered. Existing members are logged
// against the event by name/phone; new visitors get the same full
// first-timer care card + smart care-team assignment + prayer-point routing
// as a Sunday walk-in, just tagged with which event brought them in, so
// follow-up doesn't depend on them being a pre-registered member.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }

    const body = await req.json();
    const { event_id, is_new_visitor, member_id, full_name, phone, prayer_point, how_they_came, would_join } = body;
    if (!event_id) return NextResponse.json({ data: null, error: { message: 'event_id is required' } }, { status: 400 });

    const evRes = await fetch(`${SURL}/rest/v1/church_events?id=eq.${event_id}&church_id=eq.${user.church_id}&select=id,title,event_date&limit=1`, { headers: H() });
    const evData = await evRes.json();
    const event = evData?.[0];
    if (!event) return NextResponse.json({ data: null, error: { message: 'Event not found' } }, { status: 404 });

    let regName = full_name, regPhone = phone;
    if (!is_new_visitor) {
      if (!member_id) return NextResponse.json({ data: null, error: { message: 'Select an existing member' } }, { status: 400 });
      const memRes = await fetch(`${SURL}/rest/v1/members?id=eq.${member_id}&church_id=eq.${user.church_id}&select=full_name,phone&limit=1`, { headers: H() });
      const memData = await memRes.json();
      const member = memData?.[0];
      if (!member) return NextResponse.json({ data: null, error: { message: 'Member not found' } }, { status: 404 });
      regName = member.full_name; regPhone = member.phone;
    } else if (!full_name?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'Name is required for a new visitor' } }, { status: 400 });
    }

    // Check-in as an event_registrations row — the same table pre-registered
    // attendees land in, so admin views a single unified list either way.
    const existingRes = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${event_id}&${member_id ? `member_id=eq.${member_id}` : `phone=eq.${encodeURIComponent(regPhone || '')}`}&limit=1`, { headers: H() });
    const existing = await existingRes.json();
    if (existing?.[0]?.id) {
      await fetch(`${SURL}/rest/v1/event_registrations?id=eq.${existing[0].id}`, {
        method: 'PATCH', headers: { ...H(), Prefer: 'return=minimal' },
        body: JSON.stringify({ attended: true }),
      });
    } else {
      await fetch(`${SURL}/rest/v1/event_registrations`, {
        method: 'POST', headers: { ...H(), Prefer: 'return=minimal' },
        body: JSON.stringify({
          event_id, full_name: regName, phone: regPhone || null, is_member: !is_new_visitor,
          member_id: is_new_visitor ? null : member_id, attended: true, payment_status: 'free',
          registered_at: new Date().toISOString(),
        }),
      });
    }

    let firstTimerId: string | null = null;
    if (is_new_visitor) {
      const assignedTo = (await assignToLeastLoadedCareTeamMember(SURL, H(), user.church_id)) || user.id;
      const ftRes = await fetch(`${SURL}/rest/v1/first_timers`, {
        method: 'POST', headers: { ...H(), Prefer: 'return=representation' },
        body: JSON.stringify({
          full_name: full_name.trim(), phone: phone || null,
          how_they_came: how_they_came || 'event', would_join: would_join || null,
          prayer_point: prayer_point || null,
          notes: `Checked in at ${event.title} (${event.event_date})`,
          service_date: event.event_date, assigned_to: assignedTo, status: 'new',
          church_id: user.church_id || null,
        }),
      });
      const ftData = await ftRes.json();
      const created = Array.isArray(ftData) ? ftData[0] : ftData;
      firstTimerId = created?.id || null;

      if (prayer_point?.trim()) {
        try {
          const adminRes = await fetch(`${SURL}/rest/v1/users?role=in.(overseer,pa,lead_tech)&select=id`, { headers: H() });
          const admins = await adminRes.json();
          const recipients = Array.isArray(admins) ? admins.map((u: { id: string }) => u.id) : [];
          if (recipients.length > 0) {
            await fetch(`${SURL}/rest/v1/notifications`, {
              method: 'POST', headers: { ...H(), Prefer: 'return=minimal' },
              body: JSON.stringify(recipients.map((uid: string) => ({
                user_id: uid, type: 'pastoral', read: false,
                title: `Prayer point — ${full_name.trim()}`,
                body: prayer_point.trim(), link: '/care',
              }))),
            });
          }
        } catch (e) { console.error('Event checkin prayer routing error (non-fatal):', e); }
      }
    }

    return NextResponse.json({ data: { checked_in: true, first_timer_id: firstTimerId }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/events/checkin]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to check in attendee' } }, { status: 500 });
  }
}
