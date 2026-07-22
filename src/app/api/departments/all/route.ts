export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// Pastor-wide roster of all departments — distinct from /api/department/overview,
// which is scoped to a single department_head's own department.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('department_id');

    // Single-department roster with per-member latest attendance status
    if (departmentId) {
      const deptRes = await fetch(`${SUPABASE_URL}/rest/v1/departments?id=eq.${departmentId}&select=id,name&limit=1`, { headers: hdrs() });
      const deptData = await deptRes.json();
      const dept = deptData?.[0];
      if (!dept) return NextResponse.json({ data: null, error: { message: 'Department not found' } }, { status: 404 });

      const rosterRes = await fetch(
        `${SUPABASE_URL}/rest/v1/department_members?department_id=eq.${departmentId}&select=member_id,role,members(id,full_name,phone)`,
        { headers: hdrs() }
      );
      const roster = await rosterRes.json();
      const members = (Array.isArray(roster) ? roster : []).map((r: Record<string, unknown>) => {
        const m = r.members as Record<string, string> | null;
        return { id: m?.id, name: m?.full_name, phone: m?.phone, role: r.role as string };
      }).filter(m => m.id);

      const latestRecRes = await fetch(
        `${SUPABASE_URL}/rest/v1/department_attendance?department_id=eq.${departmentId}&order=submitted_at.desc&limit=1&select=id,submitted_at`,
        { headers: hdrs() }
      );
      const latestRecData = await latestRecRes.json();
      const latestRecord = latestRecData?.[0];

      let statusMap: Record<string, string> = {};
      if (latestRecord?.id) {
        const entriesRes = await fetch(
          `${SUPABASE_URL}/rest/v1/department_attendance_entries?record_id=eq.${latestRecord.id}&select=member_id,status`,
          { headers: hdrs() }
        );
        const entries = await entriesRes.json();
        if (Array.isArray(entries)) entries.forEach((e: Record<string, string>) => { if (e.member_id) statusMap[e.member_id] = e.status; });
      }

      const membersWithStatus = members.map(m => ({ ...m, status: statusMap[m.id as string] || null }));
      return NextResponse.json({
        data: { department: dept, members: membersWithStatus, last_submission: latestRecord?.submitted_at || null },
        error: null,
      });
    }

    const [deptsRes, leadersRes, membersRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/departments?select=id,name&order=name.asc`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.department_head&is_active=eq.true&select=department_id,full_name`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/department_members?select=department_id,member_id`, { headers: hdrs() }),
    ]);
    const [depts, leaders, deptMembers] = await Promise.all([deptsRes.json(), leadersRes.json(), membersRes.json()]);

    const leaderMap: Record<string, string> = {};
    if (Array.isArray(leaders)) leaders.forEach((l: Record<string, string>) => { if (l.department_id) leaderMap[l.department_id] = l.full_name; });

    const memberCount: Record<string, number> = {};
    if (Array.isArray(deptMembers)) deptMembers.forEach((d: Record<string, string>) => { if (d.department_id) memberCount[d.department_id] = (memberCount[d.department_id] || 0) + 1; });

    // Latest submitted service's attendance per department
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const attRes = await fetch(
      `${SUPABASE_URL}/rest/v1/department_attendance?submitted_at=gte.${cutoff}&order=submitted_at.desc&select=department_id,present_count,absent_count,submitted_at`,
      { headers: hdrs() }
    );
    const attRecords = await attRes.json();
    const latestAtt: Record<string, { present: number; absent: number }> = {};
    if (Array.isArray(attRecords)) {
      attRecords.forEach((r: Record<string, unknown>) => {
        const did = r.department_id as string;
        if (did && !latestAtt[did]) latestAtt[did] = { present: r.present_count as number || 0, absent: r.absent_count as number || 0 };
      });
    }

    const result = Array.isArray(depts) ? depts.map((d: Record<string, string>) => {
      const att = latestAtt[d.id];
      const count = memberCount[d.id] || 0;
      const absent = att?.absent ?? 0;
      const present = att?.present ?? 0;
      const rate = (present + absent) > 0 ? Math.round((present / (present + absent)) * 100) : null;
      const status = rate === null ? 'no_data' : rate >= 80 ? 'healthy' : rate >= 60 ? 'stable' : rate >= 40 ? 'watch' : 'alert';
      return {
        id: d.id,
        name: d.name,
        leader: leaderMap[d.id] || 'Unassigned',
        count,
        absent,
        present,
        rate,
        status,
        submitted: !!att,
      };
    }) : [];

    return NextResponse.json({ data: { departments: result }, error: null });
  } catch (err) {
    console.error('[GET /api/departments/all]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load departments' } }, { status: 500 });
  }
}
