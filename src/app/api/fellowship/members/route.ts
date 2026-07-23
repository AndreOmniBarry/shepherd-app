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

    const memberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`,
      { headers: hdrs }
    );
    const memberData = await memberRes.json();
    const fellowship_id = user.fellowship_id || memberData?.[0]?.fellowship_id;
    if (!fellowship_id) return NextResponse.json({ data: { members: [] }, error: null });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/members?fellowship_id=eq.${fellowship_id}&select=id,full_name,membership_status,last_seen,cells(name)&order=full_name.asc&limit=500`,
      { headers: hdrs }
    );
    const data = await res.json();
    const members = (Array.isArray(data) ? data : []).map((m: Record<string, unknown>) => ({
      id: m.id,
      full_name: m.full_name,
      membership_status: m.membership_status,
      cell_name: (m.cells as Record<string, string> | null)?.name || 'Unassigned',
      last_seen: m.last_seen || null,
    }));

    return NextResponse.json({ data: { members }, error: null });
  } catch (err) {
    console.error('[GET /api/fellowship/members]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load members' } }, { status: 500 });
  }
}

// Reassign a member into the correct cell — fixes the "wrongly placed member"
// data problem. Fellowship heads only, and only within their own fellowship:
// both the member and the target cell must already belong to it, so this
// can't be used to pull someone from another fellowship's roster.
export async function PATCH(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);
    if (user.role !== 'fellowship_head') {
      return NextResponse.json({ data: null, error: { message: 'Only the fellowship head can reassign a member\'s cell' } }, { status: 403 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const hdrs = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    const { member_id, cell_id } = await req.json();
    if (!member_id || !cell_id) return NextResponse.json({ data: null, error: { message: 'member_id and cell_id are required' } }, { status: 400 });

    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs });
    const userData = await userRes.json();
    const fellowship_id = user.fellowship_id || userData?.[0]?.fellowship_id;
    if (!fellowship_id) return NextResponse.json({ data: null, error: { message: 'No fellowship assigned to your account' } }, { status: 400 });

    const [memberRes, cellRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}&select=id,fellowship_id&limit=1`, { headers: hdrs }),
      fetch(`${SUPABASE_URL}/rest/v1/cells?id=eq.${cell_id}&select=id,fellowship_id&limit=1`, { headers: hdrs }),
    ]);
    const member = (await memberRes.json())?.[0];
    const cell = (await cellRes.json())?.[0];
    if (!member || member.fellowship_id !== fellowship_id) {
      return NextResponse.json({ data: null, error: { message: 'That member is not in your fellowship' } }, { status: 403 });
    }
    if (!cell || cell.fellowship_id !== fellowship_id) {
      return NextResponse.json({ data: null, error: { message: 'That cell is not in your fellowship' } }, { status: 403 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}`, {
      method: 'PATCH', headers: { ...hdrs, Prefer: 'return=minimal' },
      body: JSON.stringify({ cell_id }),
    });
    if (!res.ok) return NextResponse.json({ data: null, error: { message: 'Failed to reassign member' } }, { status: 500 });
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    console.error('[PATCH /api/fellowship/members]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to reassign member' } }, { status: 500 });
  }
}
