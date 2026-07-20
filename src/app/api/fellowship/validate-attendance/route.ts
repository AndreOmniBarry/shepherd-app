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
  return payload ? payloadToAuthUser(payload) : null;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    // Get fellowship_id
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs() });
    const userData = await userRes.json();
    const fellowship_id = userData?.[0]?.fellowship_id;

    // PA and overseer see all
    let cellFilter = '';
    if (fellowship_id && !['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      // Get cells in this fellowship
      const cellsRes = await fetch(`${SUPABASE_URL}/rest/v1/cells?fellowship_id=eq.${fellowship_id}&select=id`, { headers: hdrs() });
      const cells = await cellsRes.json();
      const cellIds = Array.isArray(cells) ? cells.map((c: Record<string, string>) => c.id) : [];
      if (cellIds.length === 0) return NextResponse.json({ data: { records: [] }, error: null });
      cellFilter = `&cell_id=in.(${cellIds.join(',')})`;
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/monthly_attendance?status=eq.pending${cellFilter}&order=month.asc&limit=500&select=id,member_id,month,times_present,total_services,exit_type,status,cells(name),members(full_name)`,
      { headers: hdrs() }
    );
    const data = await res.json();
    const records = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
      id: r.id,
      member_id: r.member_id,
      member_name: (r.members as Record<string, string> | null)?.full_name || 'Unknown',
      month: r.month,
      times_present: r.times_present,
      total_services: r.total_services,
      exit_type: r.exit_type || 'none',
      status: r.status,
      cell_name: (r.cells as Record<string, string> | null)?.name || '—',
    }));

    return NextResponse.json({ data: { records }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load records' } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { id, status } = body;

    await fetch(`${SUPABASE_URL}/rest/v1/monthly_attendance?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status, validated_by: user.id, validated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update' } }, { status: 500 });
  }
}
