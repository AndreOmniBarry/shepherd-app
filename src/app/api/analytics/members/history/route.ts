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

    const periodMs = granularity === 'year' ? 365 * 86400000 : granularity === 'week' ? 7 * 86400000 : 30 * 86400000;
    const now = new Date();
    const windowEnd = new Date(now.getTime() - offset * BUCKETS * periodMs);
    const windowStart = new Date(windowEnd.getTime() - BUCKETS * periodMs);

    const res = await fetch(`${SURL}/rest/v1/members?join_date=lte.${windowEnd.toISOString().split('T')[0]}&select=join_date${branchFilter}`, { headers: H() });
    const data = await res.json();
    const rows: { join_date: string | null }[] = Array.isArray(data) ? data : [];

    const buckets: { label: string; total: number }[] = [];
    for (let i = 0; i < BUCKETS; i++) {
      const bucketEnd = new Date(windowStart.getTime() + (i + 1) * periodMs);
      const total = rows.filter(r => r.join_date && new Date(r.join_date) < bucketEnd).length;
      const bucketStart = new Date(windowStart.getTime() + i * periodMs);
      buckets.push({
        label: granularity === 'year' ? String(bucketStart.getFullYear()) : granularity === 'week' ? bucketStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : bucketStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        total,
      });
    }

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/analytics/members/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load member growth history' } }, { status: 500 });
  }
}
