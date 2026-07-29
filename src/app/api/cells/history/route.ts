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

// Real attendance history for one cell, bucketed by week or month — no
// fabricated growth/noise. `offset` pages the window backward in time
// (offset=0 is the 12 most recent buckets, offset=1 the 12 before that),
// so the range can scale up (switch to month buckets) or move further
// back without needing a wall of preset "8w/3m/6m/1y" options.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const cell_id = searchParams.get('cell_id');
    const granularity = searchParams.get('granularity') === 'month' ? 'month' : 'week';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;
    if (!cell_id) return NextResponse.json({ data: null, error: { message: 'cell_id is required' } }, { status: 400 });

    const periodMs = granularity === 'month' ? 30 * 86400000 : 7 * 86400000;
    const now = new Date();
    const windowEnd = new Date(now.getTime() - offset * BUCKETS * periodMs);
    const windowStart = new Date(windowEnd.getTime() - BUCKETS * periodMs);

    const res = await fetch(
      `${SURL}/rest/v1/attendance_records?cell_id=eq.${cell_id}&services.service_date=gte.${windowStart.toISOString().split('T')[0]}&select=present_count,absent_count,services(service_date)&order=submitted_at.asc`,
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
        label: granularity === 'month' ? bucketStart.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : `${bucketStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        present, absent, rate: total > 0 ? Math.round((present / total) * 100) : 0,
      });
    }

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/cells/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load cell history' } }, { status: 500 });
  }
}
