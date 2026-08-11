export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });
const ADMIN_ROLES = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

async function getUser(req: Request) {
  return getAuthUser(req);
}

// The "how did this year's convention compare to last year's" view —
// registration-to-attendance, day-by-day where relevant, real-time before,
// during, and after the program, and a full list of past events to
// compare against whenever the same program recurs.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const event_id = searchParams.get('event_id');

    if (!event_id) {
      // List every event with headline stats, for browsing / comparing.
      const evRes = await fetch(`${SURL}/rest/v1/church_events?order=event_date.desc&limit=100&select=id,title,event_type,event_date,end_date,status&church_id=eq.${user.church_id}`, { headers: H() });
      const events = await evRes.json();
      const rows = Array.isArray(events) ? events : [];
      const withStats = await Promise.all(rows.map(async (e: { id: string }) => {
        const regRes = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${e.id}&select=attended,companion_count`, { headers: H() });
        const regs = await regRes.json();
        const list = Array.isArray(regs) ? regs : [];
        const attended = list.filter((r: { attended: boolean }) => r.attended).length;
        const companions = list.reduce((s: number, r: { companion_count?: number }) => s + (r.companion_count || 0), 0);
        return { ...e, registrations: list.length, attended, expected_headcount: list.length + companions, attendance_rate: list.length > 0 ? Math.round((attended / list.length) * 100) : 0 };
      }));
      return NextResponse.json({ data: { events: withStats }, error: null });
    }

    // Single event deep-dive
    const evRes = await fetch(`${SURL}/rest/v1/church_events?id=eq.${event_id}&church_id=eq.${user.church_id}&select=id,title,event_type,event_date,end_date,location,capacity,status&limit=1`, { headers: H() });
    const evData = await evRes.json();
    const event = evData?.[0];
    if (!event) return NextResponse.json({ data: null, error: { message: 'Event not found' } }, { status: 404 });

    const regRes = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${event_id}&select=id,is_member,guest_type,companion_count,attended,attending_days,registered_at`, { headers: H() });
    const regs = await regRes.json();
    const list = Array.isArray(regs) ? regs : [];

    const attended = list.filter((r: { attended: boolean }) => r.attended).length;
    const members = list.filter((r: { is_member: boolean }) => r.is_member).length;
    const ministers = list.filter((r: { guest_type: string }) => r.guest_type === 'minister').length;
    const companions = list.reduce((s: number, r: { companion_count?: number }) => s + (r.companion_count || 0), 0);

    // Registrations over time (daily, since the program was announced) —
    // shows the real-time build-up curve.
    const byDay: Record<string, number> = {};
    list.forEach((r: { registered_at: string }) => {
      const day = r.registered_at.split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });
    const registration_curve = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

    // Day-by-day attendance intent, for multi-day programs
    let day_breakdown: { date: string; planning_to_attend: number }[] = [];
    if (event.end_date && event.end_date > event.event_date) {
      const dayCounts: Record<string, number> = {};
      const cur = new Date(event.event_date + 'T00:00:00');
      const end = new Date(event.end_date + 'T00:00:00');
      while (cur <= end) { dayCounts[cur.toISOString().split('T')[0]] = 0; cur.setDate(cur.getDate() + 1); }
      list.forEach((r: { attending_days: string[] | null }) => {
        (r.attending_days || []).forEach(d => { if (d in dayCounts) dayCounts[d]++; });
      });
      day_breakdown = Object.entries(dayCounts).map(([date, planning_to_attend]) => ({ date, planning_to_attend }));
    }

    return NextResponse.json({
      data: {
        event,
        summary: {
          registrations: list.length,
          attended,
          attendance_rate: list.length > 0 ? Math.round((attended / list.length) * 100) : 0,
          members, non_members: list.length - members, ministers, companions,
          expected_headcount: list.length + companions,
        },
        registration_curve,
        day_breakdown,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/events/analytics]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load analytics' } }, { status: 500 });
  }
}
