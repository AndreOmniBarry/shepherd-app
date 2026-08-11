export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Self-serve schedule for a rank-and-file workforce member — every roster
// entry that names their member_id, across every department they've ever
// served, newest first. No department scoping needed: a member's own
// assignments are always theirs to see regardless of which department
// rostered them.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'workforce' || !user.member_id) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }

    const res = await fetch(
      `${SURL}/rest/v1/workforce_roster_entries?member_id=eq.${user.member_id}&order=created_at.desc&limit=100&select=id,role_title,position,confirmed,created_at,workforce_rosters(id,service_date,service_type,published,departments(name))`,
      { headers: H() }
    );
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];

    const entries = rows
      .map((r: Record<string, unknown>) => {
        const roster = r.workforce_rosters as Record<string, unknown> | null;
        if (!roster?.published) return null; // don't show drafts a department head hasn't published yet
        return {
          id: r.id,
          role_title: r.role_title,
          position: r.position,
          confirmed: r.confirmed,
          service_date: roster.service_date,
          service_type: roster.service_type,
          department_name: (roster.departments as Record<string, string> | null)?.name || 'Department',
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = entries.filter(e => (e.service_date as string) >= todayStr).sort((a, b) => (a.service_date as string).localeCompare(b.service_date as string));
    const past = entries.filter(e => (e.service_date as string) < todayStr);

    return NextResponse.json({ data: { upcoming, past }, error: null });
  } catch (err) {
    console.error('[GET /api/workforce/my-schedule]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load schedule' } }, { status: 500 });
  }
}

// Confirm or decline a specific assignment — the only write a workforce
// member can make on their own roster entry.
export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'workforce' || !user.member_id) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }

    const { entry_id, confirmed } = await req.json();
    if (!entry_id || typeof confirmed !== 'boolean') {
      return NextResponse.json({ data: null, error: { message: 'entry_id and confirmed are required' } }, { status: 400 });
    }

    // Ownership check — never let a workforce member confirm someone else's entry.
    const checkRes = await fetch(`${SURL}/rest/v1/workforce_roster_entries?id=eq.${entry_id}&select=member_id&limit=1`, { headers: H() });
    const checkData = await checkRes.json();
    if (checkData?.[0]?.member_id !== user.member_id) {
      return NextResponse.json({ data: null, error: { message: 'That assignment is not yours' } }, { status: 403 });
    }

    await fetch(`${SURL}/rest/v1/workforce_roster_entries?id=eq.${entry_id}`, {
      method: 'PATCH', headers: { ...H(), Prefer: 'return=minimal' },
      body: JSON.stringify({ confirmed }),
    });

    // Reliability tracking — confirming is the closest signal we have to
    // "actually served," since there's no separate workforce attendance
    // log. Recompute the 0-10 score from real assigned/attended counts
    // rather than leaving it at whatever default it was created with.
    const profRes = await fetch(`${SURL}/rest/v1/workforce_profiles?member_id=eq.${user.member_id}&select=id,total_services_assigned,total_services_attended&limit=1`, { headers: H() });
    const profData = await profRes.json();
    const profile = profData?.[0];
    if (profile) {
      const assigned = profile.total_services_assigned || 0;
      const attended = confirmed ? (profile.total_services_attended || 0) + 1 : profile.total_services_attended || 0;
      const reliability_score = assigned > 0 ? Math.round((attended / assigned) * 10 * 10) / 10 : 5.0;
      await fetch(`${SURL}/rest/v1/workforce_profiles?id=eq.${profile.id}`, {
        method: 'PATCH', headers: { ...H(), Prefer: 'return=minimal' },
        body: JSON.stringify({ total_services_attended: attended, reliability_score, last_served: confirmed ? new Date().toISOString().split('T')[0] : profile.last_served, updated_at: new Date().toISOString() }),
      });
    }

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    console.error('[PATCH /api/workforce/my-schedule]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update assignment' } }, { status: 500 });
  }
}
