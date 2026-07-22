export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// Leaders eligible to be commended — cell leaders, fellowship heads, department heads
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=id,full_name,role&role=in.(cell_leader,fellowship_head,department_head)&order=full_name.asc`,
      { headers: hdrs() }
    );
    const data = await res.json();
    return NextResponse.json({ data: { leaders: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    console.error('[GET /api/members/leaders]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load leaders' } }, { status: 500 });
  }
}
