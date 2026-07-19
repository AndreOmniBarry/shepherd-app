import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1] || req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'overseer') {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
    const hdrs = () => headers;

    const [members, activeCells, todayAttendance, ytdGiving, newMembers] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/members?select=membership_status`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/cells?is_active=eq.true&select=id`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${getMostRecentSunday()}&select=present_count,visitor_count,cell_id`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/income_records?created_at=gte.${new Date().getFullYear()}-01-01T00:00:00&select=amount,income_type_id,income_types(name,category)`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/members?join_date=gte.${getFirstOfMonth()}&membership_status=eq.active&select=id`, { headers }).then(r => r.json()),
    ]);

    const totalMembers = Array.isArray(members) ? members.length : 0;
    const activeMembers = Array.isArray(members) ? members.filter((m: Record<string,string>) => m.membership_status === 'active').length : 0;
    const activeCellsCount = Array.isArray(activeCells) ? activeCells.length : 0;
    const todayPresent = Array.isArray(todayAttendance) ? todayAttendance.reduce((s: number, r: Record<string,number>) => s + (r.present_count || 0) + (r.visitor_count || 0), 0) : 0;
    const cellsReported = Array.isArray(todayAttendance) ? new Set(todayAttendance.map((r: Record<string,string>) => r.cell_id)).size : 0;
    const ytdTotal = Array.isArray(ytdGiving) ? ytdGiving.reduce((s: number, r: Record<string,number>) => s + Number(r.amount || 0), 0) : 0;
    const newMembersCount = Array.isArray(newMembers) ? newMembers.length : 0;

    return NextResponse.json({
      data: {
        total_members: totalMembers,
        active_members: activeMembers,
        today_present: todayPresent,
        today_cells_reported: cellsReported,
        today_cells_total: activeCellsCount,
        ytd_giving_ngn: Math.round(ytdTotal),
        active_cells: activeCellsCount,
        new_members_month: newMembersCount,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/analytics/dashboard]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 });
  }
}

function getMostRecentSunday() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function getFirstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
