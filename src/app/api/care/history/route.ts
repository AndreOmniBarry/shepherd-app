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

const RESOLVED_TIMER = new Set(['converted', 'declined']);
const RESOLVED_LEAD = new Set(['restored', 'unreachable', 'closed']);

// Care & follow-up history, bucketed by week or month — reuses the exact
// {label,present,absent,rate} shape attendance history uses (present =
// resolved in that bucket, absent = still open, rate = resolution rate),
// so it plugs straight into the same AttendanceHistoryPanel component
// instead of needing its own chart built from scratch.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech', 'care_team'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const granularity = searchParams.get('granularity') === 'month' ? 'month' : 'week';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;

    const branchId = user.role === 'branch_pastor' ? user.branch_id : searchParams.get('branch_id');
    const branchFilter = branchId ? `&branch_id=eq.${branchId}` : '';

    const periodMs = granularity === 'month' ? 30 * 86400000 : 7 * 86400000;
    const now = new Date();
    const windowEnd = new Date(now.getTime() - offset * BUCKETS * periodMs);
    const windowStart = new Date(windowEnd.getTime() - BUCKETS * periodMs);

    const [timersRes, leadsRes] = await Promise.all([
      fetch(`${SURL}/rest/v1/first_timers?created_at=gte.${windowStart.toISOString()}&created_at=lt.${windowEnd.toISOString()}&select=created_at,status,outcome${branchFilter}`, { headers: H() }),
      fetch(`${SURL}/rest/v1/care_leads?created_at=gte.${windowStart.toISOString()}&created_at=lt.${windowEnd.toISOString()}&select=created_at,status${branchFilter}`, { headers: H() }),
    ]);
    const timersData = await timersRes.json().catch(() => null);
    const leadsData = await leadsRes.json().catch(() => null);
    const timers: { created_at: string; status: string; outcome: string | null }[] = Array.isArray(timersData) ? timersData : [];
    const leads: { created_at: string; status: string }[] = Array.isArray(leadsData) ? leadsData : [];

    const buckets: { label: string; present: number; absent: number; rate: number }[] = [];
    for (let i = 0; i < BUCKETS; i++) {
      const bucketStart = new Date(windowStart.getTime() + i * periodMs);
      const bucketEnd = new Date(bucketStart.getTime() + periodMs);

      const bucketTimers = timers.filter(r => {
        const d = new Date(r.created_at);
        return d >= bucketStart && d < bucketEnd;
      });
      const bucketLeads = leads.filter(r => {
        const d = new Date(r.created_at);
        return d >= bucketStart && d < bucketEnd;
      });

      const resolved = bucketTimers.filter(r => RESOLVED_TIMER.has(r.outcome || r.status)).length
        + bucketLeads.filter(r => RESOLVED_LEAD.has(r.status)).length;
      const total = bucketTimers.length + bucketLeads.length;
      const open = total - resolved;

      buckets.push({
        label: granularity === 'month' ? bucketStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : bucketStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        present: resolved, absent: open,
        rate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      });
    }

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/care/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load care history' } }, { status: 500 });
  }
}
