export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1] || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);
    if (user.role !== 'overseer') return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

    // Get all active cells with fellowship
    const cellsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cells?is_active=eq.true&select=id,name,fellowship_id,target_size,fellowships(name)&order=fellowship_id.asc,name.asc`,
      { headers }
    );
    const cells = await cellsRes.json();

    // Get cell leaders from users table
    const leadersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.cell_leader&is_active=eq.true&select=cell_id,full_name,email`,
      { headers }
    );
    const leaders = await leadersRes.json();

    // Get member counts per cell
    const membersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?membership_status=eq.active&select=cell_id`,
      { headers }
    );
    const members = await membersRes.json();

    // Build member count map
    const memberCount: Record<string, number> = {};
    if (Array.isArray(members)) {
      members.forEach((m: Record<string, string>) => {
        if (m.cell_id) memberCount[m.cell_id] = (memberCount[m.cell_id] || 0) + 1;
      });
    }

    // Build leader map
    const leaderMap: Record<string, string> = {};
    if (Array.isArray(leaders)) {
      leaders.forEach((l: Record<string, string>) => {
        if (l.cell_id) leaderMap[l.cell_id] = l.full_name;
      });
    }

    // Get last 8 weeks attendance per cell
    const since = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
    const attRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${since}&select=cell_id,present_count,submitted_at&order=submitted_at.asc`,
      { headers }
    );
    const attRecords = await attRes.json();

    // Build attendance history per cell
    const attMap: Record<string, number[]> = {};
    if (Array.isArray(attRecords)) {
      attRecords.forEach((r: Record<string, unknown>) => {
        const cid = r.cell_id as string;
        if (cid) {
          if (!attMap[cid]) attMap[cid] = [];
          attMap[cid].push(r.present_count as number);
        }
      });
    }

    const result = Array.isArray(cells) ? cells.map((c: Record<string, unknown>) => {
      const fellowship = c.fellowships as Record<string, string>;
      const cid = c.id as string;
      const history = attMap[cid] || [];
      const avg = history.length > 0 ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
      const count = memberCount[cid] || 0;
      const rate = count > 0 ? Math.round((avg / count) * 100) : 0;

      // Calculate trend
      let trend = '+0%';
      let status = 'stable';
      if (history.length >= 4) {
        const recent = history.slice(-2).reduce((a, b) => a + b, 0) / 2;
        const older = history.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
        if (older > 0) {
          const pct = Math.round(((recent - older) / older) * 100);
          trend = pct >= 0 ? `+${pct}%` : `${pct}%`;
          status = pct >= 10 ? 'rising' : pct <= -10 ? 'alert' : pct <= -3 ? 'watch' : 'stable';
        }
      }

      return {
        id: cid,
        cell: c.name,
        fel: fellowship?.name?.replace(' Fellowship', '') || 'Unknown',
        leader: leaderMap[cid] || 'Unassigned',
        members: count,
        avg,
        rate: Math.min(rate, 95),
        trend,
        status,
        history,
      };
    }) : [];

    return NextResponse.json({ data: { cells: result }, error: null });
  } catch (err) {
    console.error('[GET /api/cells/all]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load cells' } }, { status: 500 });
  }
}
