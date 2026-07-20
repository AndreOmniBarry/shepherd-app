export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1] || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);
    if (user.role !== 'overseer') return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

    // Last 24 hours of real submissions
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${since}&order=submitted_at.desc&limit=20&select=id,present_count,absent_count,visitor_count,submitted_at,cell_id,cells(name,fellowship_id,fellowships(name))`,
      { headers }
    );
    const records = await res.json();

    // Today summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${todayStart.toISOString()}&select=present_count,visitor_count,cell_id`,
      { headers }
    );
    const todayRecords = await todayRes.json();

    const todayPresent = Array.isArray(todayRecords)
      ? todayRecords.reduce((s: number, r: Record<string,number>) => s + (r.present_count || 0), 0) : 0;
    const cellsReported = Array.isArray(todayRecords)
      ? new Set(todayRecords.map((r: Record<string,string>) => r.cell_id)).size : 0;

    const feed = Array.isArray(records) ? records.map((r: Record<string,unknown>) => {
      const cell = r.cells as Record<string,unknown>;
      const fellowship = cell?.fellowships as Record<string,string>;
      const minsAgo = Math.floor((Date.now() - new Date(r.submitted_at as string).getTime()) / 60000);
      return {
        id: r.id,
        cell: cell?.name || 'Unknown Cell',
        fellowship: fellowship?.name || 'Unknown Fellowship',
        present: r.present_count,
        absent: r.absent_count,
        visitors: r.visitor_count,
        submitted_at: r.submitted_at,
        mins_ago: minsAgo,
      };
    }) : [];

    return NextResponse.json({ data: { feed, today_present: todayPresent, cells_reported: cellsReported }, error: null });
  } catch (err) {
    console.error('[GET /api/analytics/live]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 });
  }
}
