import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

// Feeds the shared /update portal's member list (profile housecleaning,
// attendance backdating, removal recommendations) for whichever role is
// logged in. Previously this tried to resolve scope by looking up a
// `members` row matching the caller's own `users.id` — leader accounts
// don't have a members row with that id, so it silently returned an empty
// list for every role, every time (profiles/attendance/removal tabs all
// looked "empty" no matter how many real members existed).
export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const hdrs = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

    type Row = { id: string; full_name: string; membership_status: string; cell_name: string };
    const mapRow = (m: Record<string, unknown>): Row => ({
      id: m.id as string,
      full_name: m.full_name as string,
      membership_status: m.membership_status as string,
      cell_name: (m.cells as Record<string, string> | null)?.name || 'Unassigned',
    });

    let members: Row[] = [];

    if (user.role === 'cell_leader' && user.cell_id) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/members?cell_id=eq.${user.cell_id}&select=id,full_name,membership_status,cells(name)&order=full_name.asc&limit=500`,
        { headers: hdrs }
      );
      const data = await res.json();
      members = (Array.isArray(data) ? data : []).map(mapRow);
    } else if (user.role === 'fellowship_head' && user.fellowship_id) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/members?fellowship_id=eq.${user.fellowship_id}&select=id,full_name,membership_status,cells(name)&order=full_name.asc&limit=500`,
        { headers: hdrs }
      );
      const data = await res.json();
      members = (Array.isArray(data) ? data : []).map(mapRow);
    } else if (user.role === 'department_head') {
      const deptRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: hdrs });
      const deptData = await deptRes.json();
      const department_id = deptData?.[0]?.department_id;
      if (department_id) {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/department_members?department_id=eq.${department_id}&select=members(id,full_name,membership_status,cells(name))`,
          { headers: hdrs }
        );
        const data = await res.json();
        members = (Array.isArray(data) ? data : [])
          .map((r: Record<string, unknown>) => r.members as Record<string, unknown> | null)
          .filter((m): m is Record<string, unknown> => !!m)
          .map(mapRow)
          .sort((a, b) => a.full_name.localeCompare(b.full_name));
      }
    }

    return NextResponse.json({ data: { members }, error: null });
  } catch (err) {
    console.error('[GET /api/update/members]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load members' } }, { status: 500 });
  }
}
