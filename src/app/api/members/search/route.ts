import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` });

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const ALLOWED_ROLES = ['overseer', 'pa', 'lead_tech', 'fellowship_head', 'department_head', 'cell_leader', 'care_team'];
    if (!ALLOWED_ROLES.includes(String(payload.role))) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized to search members' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    const select = 'id,full_name,phone,membership_status,join_date,cells(name),fellowships(name)';
    let url = `${SUPABASE_URL}/rest/v1/members?select=${select}&order=join_date.desc.nullslast&limit=200`;
    if (q.length >= 2) {
      url = `${SUPABASE_URL}/rest/v1/members?full_name=ilike.*${q}*&select=${select}&order=full_name.asc&limit=50`;
    }

    const res = await fetch(url, { headers: hdrs() });
    const data = await res.json();
    const members = (Array.isArray(data) ? data : []).map((m: Record<string, unknown>) => ({
      id: m.id,
      full_name: m.full_name,
      phone: m.phone,
      membership_status: m.membership_status,
      join_date: m.join_date,
      cell_name: (m.cells as Record<string, string> | null)?.name || null,
      fellowship_name: (m.fellowships as Record<string, string> | null)?.name || null,
    }));
    return NextResponse.json({ data: { members }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to search members' } }, { status: 500 });
  }
}
