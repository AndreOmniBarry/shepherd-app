export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { bucketBounds } from '@/lib/history-buckets';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Member growth history — cumulative member count as of the end of each
// week/month/year bucket, paginated the same way as every other history
// view. {label,total} shape, same as giving history, since this is a
// running total rather than a present/absent rate.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const granularityParam = searchParams.get('granularity');
    const granularity = granularityParam === 'year' ? 'year' : granularityParam === 'week' ? 'week' : 'month';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;

    const branchId = user.role === 'branch_pastor' ? user.branch_id : searchParams.get('branch_id');
    const branchFilter = branchId ? `&branch_id=eq.${branchId}` : '';

    const bounds = bucketBounds(granularity, offset, BUCKETS);
    const windowStart = bounds[0].start;
    const windowEnd = bounds[bounds.length - 1].end;

    const res = await fetch(`${SURL}/rest/v1/members?join_date=lte.${windowEnd.toISOString().split('T')[0]}&select=join_date&church_id=eq.${user.church_id}${branchFilter}`, { headers: H() });
    const data = await res.json();
    const rows: { join_date: string | null }[] = Array.isArray(data) ? data : [];

    // Cumulative count as of each bucket's END (running total, not a
    // per-bucket delta) — a member counts toward every bucket from the one
    // they joined in onward.
    const buckets = bounds.map(b => ({ label: b.label, total: rows.filter(r => r.join_date && new Date(r.join_date) < b.end).length }));

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/analytics/members/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load member growth history' } }, { status: 500 });
  }
}
