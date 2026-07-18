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
