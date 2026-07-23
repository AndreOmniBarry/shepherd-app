import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const hdrs = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    // Get fellowship_id from members table
    const memberRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`,
      { headers: hdrs }
    );
    const memberData = await memberRes.json();
    const fellowship_id = user.fellowship_id || memberData?.[0]?.fellowship_id;
    if (!fellowship_id) return NextResponse.json({ data: { cells: [] }, error: null });

    // Get all cells in fellowship
    const cellsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cells?fellowship_id=eq.${fellowship_id}&select=id,name,member_count,leader:members(full_name)&order=name.asc`,
      { headers: hdrs }
    );
    const cellsData = await cellsRes.json();

    // Get last Sunday's attendance for each cell
    const lastSunday = new Date();
    const dayOfWeek = lastSunday.getDay();
    lastSunday.setDate(lastSunday.getDate() - (dayOfWeek === 0 ? 0 : dayOfWeek));
    const sundayStr = lastSunday.toISOString().split('T')[0];

    const svcIdsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=eq.${sundayStr}&select=id`,
      { headers: hdrs }
    );
    const svcIdsData = await svcIdsRes.json();
    const svcIds: string[] = Array.isArray(svcIdsData) ? svcIdsData.map((s: Record<string, string>) => s.id) : [];

    const attData = svcIds.length > 0 ? await (async () => {
      const attRes = await fetch(
        `${SUPABASE_URL}/rest/v1/attendance_records?service_id=in.(${svcIds.join(',')})&select=id,cell_id,present_count,absent_count,submitted_at,sla_grade&order=submitted_at.desc`,
        { headers: hdrs }
      );
      return attRes.json();
    })() : [];
    const attMap: Record<string, { id: string; present: number; absent: number; submitted_at: string; sla_grade: string }> = {};
    if (Array.isArray(attData)) {
      attData.forEach((a: Record<string, unknown>) => {
        if (a.cell_id && !attMap[a.cell_id as string]) {
          attMap[a.cell_id as string] = {
            id: a.id as string,
            present: a.present_count as number,
            absent: a.absent_count as number,
            submitted_at: a.submitted_at as string,
            sla_grade: a.sla_grade as string,
          };
        }
      });
    }

    // Get 8-week trend per cell (simplified)
    const trendCutoff = new Date();
    trendCutoff.setDate(trendCutoff.getDate() - 56);
    const trendRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${trendCutoff.toISOString()}&select=cell_id,present_count,submitted_at&order=submitted_at.asc`,
      { headers: hdrs }
    );
    const trendData = await trendRes.json();
    const trendMap: Record<string, { w: string; v: number }[]> = {};
    if (Array.isArray(trendData)) {
      trendData.forEach((r: Record<string, unknown>, i: number) => {
        const cid = r.cell_id as string;
        if (!trendMap[cid]) trendMap[cid] = [];
        if (trendMap[cid].length < 8) {
          trendMap[cid].push({ w: `W${trendMap[cid].length + 1}`, v: r.present_count as number });
        }
      });
    }

    // Determine submission window (last 7 days)
    const windowCutoff = new Date();
    windowCutoff.setDate(windowCutoff.getDate() - 7);

    const cells = (Array.isArray(cellsData) ? cellsData : []).map((c: Record<string, unknown>) => {
      const att = attMap[c.id as string];
      const total = (att?.present || 0) + (att?.absent || 0);
      const leader = c.leader as Record<string, string> | null;
      return {
        id: c.id,
        record_id: att?.id,
        name: c.name,
        leader_name: leader?.full_name || 'Unassigned',
        member_count: c.member_count || 0,
        last_present: att?.present,
        last_absent: att?.absent,
        last_rate: total > 0 ? Math.round((att.present / total) * 100) : undefined,
        sla_grade: att?.sla_grade,
        last_submission: att?.submitted_at,
        status: att ? 'submitted' : new Date() > new Date(windowCutoff) ? 'pending' : 'overdue',
        trend: trendMap[c.id as string] || [],
      };
    });

    return NextResponse.json({ data: { cells }, error: null });
  } catch (err) {
    console.error('[GET /api/fellowship/cells]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load cells' } }, { status: 500 });
  }
}

// Fixes wrongly-named cells — fellowship heads only, own fellowship only.
export async function PATCH(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);
    if (user.role !== 'fellowship_head') {
      return NextResponse.json({ data: null, error: { message: 'Only the fellowship head can rename a cell' } }, { status: 403 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const hdrs = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    const { cell_id, name } = await req.json();
    if (!cell_id || !name?.trim()) return NextResponse.json({ data: null, error: { message: 'cell_id and name are required' } }, { status: 400 });

    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs });
    const userData = await userRes.json();
    const fellowship_id = user.fellowship_id || userData?.[0]?.fellowship_id;
    if (!fellowship_id) return NextResponse.json({ data: null, error: { message: 'No fellowship assigned to your account' } }, { status: 400 });

    const cellRes = await fetch(`${SUPABASE_URL}/rest/v1/cells?id=eq.${cell_id}&select=id,fellowship_id&limit=1`, { headers: hdrs });
    const cell = (await cellRes.json())?.[0];
    if (!cell || cell.fellowship_id !== fellowship_id) {
      return NextResponse.json({ data: null, error: { message: 'That cell is not in your fellowship' } }, { status: 403 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/cells?id=eq.${cell_id}`, {
      method: 'PATCH', headers: { ...hdrs, Prefer: 'return=minimal' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) return NextResponse.json({ data: null, error: { message: 'Failed to rename cell' } }, { status: 500 });
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    console.error('[PATCH /api/fellowship/cells]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to rename cell' } }, { status: 500 });
  }
}
