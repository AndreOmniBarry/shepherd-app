export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Real attendance history for one department, bucketed by week or month —
// same contract as /api/cells/history so both plug into the same
// AttendanceHistoryPanel component.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    let department_id = searchParams.get('department_id');
    const granularity = searchParams.get('granularity') === 'month' ? 'month' : 'week';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;

    if (user.role === 'department_head') {
      // A department head can only ever see their own department's history,
      // regardless of whatever department_id was passed in.
      const res = await fetch(`${SURL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: H() });
      const rows = await res.json();
      department_id = Array.isArray(rows) ? rows[0]?.department_id : null;
      if (!department_id) return NextResponse.json({ data: null, error: { message: 'No department assigned' } }, { status: 403 });
    } else if (!['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    if (!department_id) return NextResponse.json({ data: null, error: { message: 'department_id is required' } }, { status: 400 });

    const periodMs = granularity === 'month' ? 30 * 86400000 : 7 * 86400000;
    const now = new Date();
    const windowEnd = new Date(now.getTime() - offset * BUCKETS * periodMs);
    const windowStart = new Date(windowEnd.getTime() - BUCKETS * periodMs);

    const res = await fetch(
      `${SURL}/rest/v1/department_attendance?department_id=eq.${department_id}&submitted_at=gte.${windowStart.toISOString()}&select=present_count,absent_count,submitted_at&order=submitted_at.asc`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { present_count: number; absent_count: number; submitted_at: string }[] = Array.isArray(records) ? records : [];

    const buckets: { label: string; present: number; absent: number; rate: number }[] = [];
    for (let i = 0; i < BUCKETS; i++) {
      const bucketStart = new Date(windowStart.getTime() + i * periodMs);
      const bucketEnd = new Date(bucketStart.getTime() + periodMs);
      const inBucket = rows.filter(r => {
        const d = new Date(r.submitted_at);
        return d >= bucketStart && d < bucketEnd;
      });
      const present = inBucket.reduce((s, r) => s + (r.present_count || 0), 0);
      const absent = inBucket.reduce((s, r) => s + (r.absent_count || 0), 0);
      const total = present + absent;
      buckets.push({
        label: granularity === 'month' ? bucketStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : bucketStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        present, absent, rate: total > 0 ? Math.round((present / total) * 100) : 0,
      });
    }

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/department/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load department history' } }, { status: 500 });
  }
}
