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

// Same real, bucketed pattern as /api/cells/history, aggregated across every
// cell in the caller's own fellowship instead of a single cell.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['fellowship_head', 'overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const fellowship_id = user.role === 'fellowship_head' ? user.fellowship_id : searchParams.get('fellowship_id');
    if (!fellowship_id) return NextResponse.json({ data: null, error: { message: 'fellowship_id is required' } }, { status: 400 });

    const granularityParam = searchParams.get('granularity');
    const granularity = granularityParam === 'year' ? 'year' : granularityParam === 'month' ? 'month' : 'week';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;

    const periodMs = granularity === 'year' ? 365 * 86400000 : granularity === 'month' ? 30 * 86400000 : 7 * 86400000;
    const now = new Date();
    const windowEnd = new Date(now.getTime() - offset * BUCKETS * periodMs);
    const windowStart = new Date(windowEnd.getTime() - BUCKETS * periodMs);

    const cellsRes = await fetch(`${SURL}/rest/v1/cells?fellowship_id=eq.${fellowship_id}&select=id`, { headers: H() });
    const cellRows: { id: string }[] = await cellsRes.json();
    const cellIds = (Array.isArray(cellRows) ? cellRows : []).map(c => c.id);

    if (cellIds.length === 0) {
      const buckets = Array.from({ length: BUCKETS }, (_, i) => {
        const bucketStart = new Date(windowStart.getTime() + i * periodMs);
        return { label: granularity === 'year' ? String(bucketStart.getFullYear()) : granularity === 'month' ? bucketStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : bucketStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), present: 0, absent: 0, rate: 0 };
      });
      return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
    }

    const res = await fetch(
      `${SURL}/rest/v1/attendance_records?cell_id=in.(${cellIds.join(',')})&services.service_date=gte.${windowStart.toISOString().split('T')[0]}&select=present_count,absent_count,services(service_date)&order=submitted_at.asc`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { present_count: number; absent_count: number; services: { service_date: string } | null }[] = Array.isArray(records) ? records : [];

    const buckets: { label: string; present: number; absent: number; rate: number }[] = [];
    for (let i = 0; i < BUCKETS; i++) {
      const bucketStart = new Date(windowStart.getTime() + i * periodMs);
      const bucketEnd = new Date(bucketStart.getTime() + periodMs);
      const inBucket = rows.filter(r => {
        const d = r.services?.service_date ? new Date(r.services.service_date) : null;
        return d && d >= bucketStart && d < bucketEnd;
      });
      const present = inBucket.reduce((s, r) => s + (r.present_count || 0), 0);
      const absent = inBucket.reduce((s, r) => s + (r.absent_count || 0), 0);
      const total = present + absent;
      buckets.push({
        label: granularity === 'year' ? String(bucketStart.getFullYear()) : granularity === 'month' ? bucketStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : bucketStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        present, absent, rate: total > 0 ? Math.round((present / total) * 100) : 0,
      });
    }

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/fellowship/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load fellowship history' } }, { status: 500 });
  }
}
