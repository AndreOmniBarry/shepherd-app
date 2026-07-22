import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

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

    // Resolve department_id from the users table — this is a department head's own
    // login account, not a row in `members` (that table has no relation to user ids).
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: hdrs });
    const userData = await userRes.json();
    const department_id = userData?.[0]?.department_id;
    if (!department_id) return NextResponse.json({ data: { members: [] }, error: null });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/department_members?department_id=eq.${department_id}&select=role,members(id,full_name,phone,membership_status)`,
      { headers: hdrs }
    );
    const data = await res.json();
    const members = (Array.isArray(data) ? data : []).map((d: Record<string, unknown>) => {
      const mem = d.members as Record<string, unknown> | null;
      return {
        id: mem?.id,
        full_name: mem?.full_name,
        phone: mem?.phone,
        membership_status: mem?.membership_status,
        role: d.role,
      };
    }).filter(mem => mem.id);

    return NextResponse.json({ data: { members }, error: null });
  } catch (err) {
    console.error('[GET /api/department/members]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load members' } }, { status: 500 });
  }
}
