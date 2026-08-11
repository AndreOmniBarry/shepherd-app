export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { bucketBounds } from '@/lib/history-buckets';
import { resolveBranchScope } from '@/lib/branch-scope';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  return getAuthUser(req);
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

    // branch_pastor is branch-locked; PA is church-wide (not branch-locked)
    // by founder decision — matches the other routes that treat PA this way.
    const { branchFilter, forbidden } = resolveBranchScope(user, searchParams, ['branch_pastor']);
    if (forbidden) {
      return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
    }

    const bounds = bucketBounds(granularity, offset, BUCKETS);
    const windowStart = bounds[0].start;
    const windowEnd = bounds[bounds.length - 1].end;

    const res = await fetch(
      `${SURL}/rest/v1/income_records?service_date=gte.${windowStart.toISOString().split('T')[0]}&service_date=lte.${windowEnd.toISOString().split('T')[0]}&select=amount,service_date&church_id=eq.${user.church_id}${branchFilter}`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { amount: number; service_date: string }[] = Array.isArray(records) ? records : [];

    const buckets = bounds.map(b => ({
      label: b.label,
      total: rows.filter(r => { const d = new Date(r.service_date + 'T00:00:00'); return d >= b.start && d < b.end; }).reduce((s, r) => s + Number(r.amount || 0), 0),
    }));

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/analytics/giving/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load giving history' } }, { status: 500 });
  }
}
