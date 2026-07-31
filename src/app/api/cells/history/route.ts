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

// Real attendance history for one cell, bucketed by week or month — no
// fabricated growth/noise. `offset` pages the window backward in time
// (offset=0 is the 12 most recent buckets, offset=1 the 12 before that),
// so the range can scale up (switch to month buckets) or move further
// back without needing a wall of preset "8w/3m/6m/1y" options.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    let cell_id = searchParams.get('cell_id');
    const granularityParam = searchParams.get('granularity');
    const granularity = granularityParam === 'year' ? 'year' : granularityParam === 'month' ? 'month' : 'week';
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const BUCKETS = 12;

    if (user.role === 'cell_leader') {
      // A cell leader can only ever see their own cell's history, regardless
      // of whatever cell_id was passed in.
      if (!user.cell_id) return NextResponse.json({ data: null, error: { message: 'No cell assigned' } }, { status: 403 });
      cell_id = user.cell_id;
    } else if (user.role === 'fellowship_head') {
      if (!cell_id) return NextResponse.json({ data: null, error: { message: 'cell_id is required' } }, { status: 400 });
      const ownRes = await fetch(`${SURL}/rest/v1/cells?id=eq.${cell_id}&select=fellowship_id`, { headers: H() });
      const ownRows = await ownRes.json();
      const cellFellowshipId = Array.isArray(ownRows) ? ownRows[0]?.fellowship_id : null;
      if (!cellFellowshipId || cellFellowshipId !== user.fellowship_id) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
    } else if (!['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    if (!cell_id) return NextResponse.json({ data: null, error: { message: 'cell_id is required' } }, { status: 400 });

    const bounds = bucketBounds(granularity, offset, BUCKETS);
    const windowStart = bounds[0].start;
    const windowEnd = bounds[bounds.length - 1].end;

    const res = await fetch(
      `${SURL}/rest/v1/attendance_records?cell_id=eq.${cell_id}&services.service_date=gte.${windowStart.toISOString().split('T')[0]}&select=present_count,absent_count,services(service_date)&order=submitted_at.asc`,
      { headers: H() }
    );
    const records = await res.json();
    const rows: { present_count: number; absent_count: number; services: { service_date: string } | null }[] = Array.isArray(records) ? records : [];

    const buckets = bounds.map(b => {
      const inBucket = rows.filter(r => {
        const d = r.services?.service_date ? new Date(r.services.service_date) : null;
        return d && d >= b.start && d < b.end;
      });
      const present = inBucket.reduce((s, r) => s + (r.present_count || 0), 0);
      const absent = inBucket.reduce((s, r) => s + (r.absent_count || 0), 0);
      const total = present + absent;
      return { label: b.label, present, absent, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
    });

    return NextResponse.json({ data: { buckets, window_start: windowStart.toISOString().split('T')[0], window_end: windowEnd.toISOString().split('T')[0] }, error: null });
  } catch (err) {
    console.error('[GET /api/cells/history]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load cell history' } }, { status: 500 });
  }
}
