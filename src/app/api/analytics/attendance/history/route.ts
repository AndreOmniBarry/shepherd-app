export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { bucketBounds } from '@/lib/history-buckets';
import { resolveBranchScope } from '@/lib/branch-scope';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Church/branch-wide attendance history for the dashboard overview widget —
// same {label,present,absent,rate} week/month/year paginated contract as
// cells/fellowship/department history, aggregated across every cell in the
// relevant branch (or the whole church for the consolidated view) instead
// of a single cell.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const granularityParam = searchParams.get('granularity');
    const granularity = granularityParam === 'year' ? 'year' : granularityParam === 'month' ? 'month' : 'week';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;

    const { branchId, forbidden } = resolveBranchScope(user, searchParams);
    if (forbidden) {
      return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
    }

    const bounds = bucketBounds(granularity, offset, BUCKETS);
    const windowStart = bounds[0].start;
    const windowEnd = bounds[bounds.length - 1].end;

    // attendance_records carries no church_id of its own, so it's always
    // scoped via the cells that belong to this caller's church (and,
    // optionally, a specific branch within it) — otherwise the
    // consolidated view (no branch_id given) would leak every church's
    // attendance history.
    let cellsUrl = `${SURL}/rest/v1/cells?church_id=eq.${user.church_id}&select=id`;
    if (branchId) cellsUrl += `&branch_id=eq.${branchId}`;
    const cellsRes = await fetch(cellsUrl, { headers: H() });
    const cellRows: { id: string }[] = await cellsRes.json();
    const cellIds = (Array.isArray(cellRows) ? cellRows : []).map(c => c.id);
    const cellFilter = cellIds.length > 0 ? `&cell_id=in.(${cellIds.join(',')})` : '&cell_id=eq.00000000-0000-0000-0000-000000000000';

    const res = await fetch(
      `${SURL}/rest/v1/attendance_records?services.service_date=gte.${windowStart.toISOString().split('T')[0]}&select=present_count,absent_count,visitor_count,services(service_date)${cellFilter}`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { present_count: number; absent_count: number; visitor_count: number; services: { service_date: string } | null }[] = Array.isArray(records) ? records : [];

    const buckets = bounds.map(b => {
      const inBucket = rows.filter(r => {
        const d = r.services?.service_date ? new Date(r.services.service_date) : null;
        return d && d >= b.start && d < b.end;
      });
      const present = inBucket.reduce((s, r) => s + (r.present_count || 0) + (r.visitor_count || 0), 0);
      const absent = inBucket.reduce((s, r) => s + (r.absent_count || 0), 0);
      const total = present + absent;
      return { label: b.label, present, absent, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
    });

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/analytics/attendance/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load attendance history' } }, { status: 500 });
  }
}
