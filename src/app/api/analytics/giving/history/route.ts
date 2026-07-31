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

// Same paginated week/month/year pattern as attendance/care/department
// history — total giving per bucket instead of a present/absent rate.
// Offset pages further back in time; the frontend skips empty buckets on
// its own using the same jump-to-data logic.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech', 'accounts'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const granularityParam = searchParams.get('granularity');
    const granularity = granularityParam === 'year' ? 'year' : granularityParam === 'week' ? 'week' : 'month';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;

    const branchId = ['pa', 'branch_pastor'].includes(user.role) ? user.branch_id : searchParams.get('branch_id');
    const branchFilter = branchId ? `&branch_id=eq.${branchId}` : '';

    const periodMs = granularity === 'year' ? 365 * 86400000 : granularity === 'week' ? 7 * 86400000 : 30 * 86400000;
    const now = new Date();
    const windowEnd = new Date(now.getTime() - offset * BUCKETS * periodMs);
    const windowStart = new Date(windowEnd.getTime() - BUCKETS * periodMs);

    const res = await fetch(
      `${SURL}/rest/v1/income_records?service_date=gte.${windowStart.toISOString().split('T')[0]}&service_date=lte.${windowEnd.toISOString().split('T')[0]}&select=amount,service_date${branchFilter}`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { amount: number; service_date: string }[] = Array.isArray(records) ? records : [];

    const buckets: { label: string; total: number }[] = [];
    for (let i = 0; i < BUCKETS; i++) {
      const bucketStart = new Date(windowStart.getTime() + i * periodMs);
      const bucketEnd = new Date(bucketStart.getTime() + periodMs);
      const total = rows.filter(r => {
        const d = new Date(r.service_date + 'T00:00:00');
        return d >= bucketStart && d < bucketEnd;
      }).reduce((s, r) => s + Number(r.amount || 0), 0);
      buckets.push({
        label: granularity === 'year' ? String(bucketStart.getFullYear()) : granularity === 'week' ? bucketStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : bucketStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        total,
      });
    }

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/analytics/giving/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load giving history' } }, { status: 500 });
  }
}
