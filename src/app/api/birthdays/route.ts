import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// ── Real birthday data for BirthdayPanel.tsx ──────────────────────────
// This route used to be a copy-paste leftover of /api/notifications (same
// query, same `notifications` table, same shape) — so every "Birthdays"
// tab in the app (cell, fellowship, department, and care/"all" portals)
// always rendered "No birthdays today" / "No birthdays this month"
// regardless of reality, silently. This is the real implementation:
// resolves the right member pool for the caller's role/scope, then
// buckets everyone with a date_of_birth on file into today / upcoming
// (next 30 days) / this month.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

type MemberRow = { id: string; full_name: string; date_of_birth: string | null; cell_id?: string | null };
type CellInfo = { id: string; name: string; fellowship_id: string | null; fellowship_name: string | null };

function computeBirthday(dob: string, today: Date) {
  const [byStr, bmStr, bdStr] = dob.split('-');
  const by = parseInt(byStr, 10), bm = parseInt(bmStr, 10), bd = parseInt(bdStr, 10);
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisYearOcc = new Date(todayMid.getFullYear(), bm - 1, bd);
  const daysUntilThisYear = Math.round((thisYearOcc.getTime() - todayMid.getTime()) / 86400000);
  const nextYearOcc = new Date(todayMid.getFullYear() + 1, bm - 1, bd);
  const daysUntilNextYear = Math.round((nextYearOcc.getTime() - todayMid.getTime()) / 86400000);
  const daysUntilUpcoming = daysUntilThisYear >= 0 ? daysUntilThisYear : daysUntilNextYear;
  return {
    birth_month: bm - 1,
    birth_day: bd,
    is_today: daysUntilThisYear === 0,
    is_this_month: thisYearOcc.getMonth() === todayMid.getMonth(),
    days_until_this_year: daysUntilThisYear,
    days_until_upcoming: daysUntilUpcoming,
    age_turning_this_year: todayMid.getFullYear() - by,
    age_turning_upcoming: (daysUntilThisYear >= 0 ? todayMid.getFullYear() : todayMid.getFullYear() + 1) - by,
  };
}

async function fetchCellsWithFellowship(ids: string[]): Promise<Record<string, CellInfo>> {
  if (ids.length === 0) return {};
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cells?id=in.(${ids.join(',')})&select=id,name,fellowship_id,fellowships(name)`, { headers: hdrs() });
  const rows = await res.json().catch(() => []);
  const out: Record<string, CellInfo> = {};
  (Array.isArray(rows) ? rows : []).forEach((r: Record<string, unknown>) => {
    out[r.id as string] = { id: r.id as string, name: r.name as string, fellowship_id: r.fellowship_id as string | null, fellowship_name: (r.fellowships as { name?: string } | null)?.name || null };
  });
  return out;
}

// Resolves the member pool this caller may see birthdays for, matching
// the same role → scope convention used throughout (cell_leader/
// fellowship_head/department_head/branch-scoped leadership).
async function resolveMemberIds(user: { id: string; role: string; church_id?: string | null; cell_id?: string | null; fellowship_id?: string | null; branch_id?: string | null }, scope: string): Promise<{ query: string } | null> {
  const churchFilter = user.church_id ? `&church_id=eq.${user.church_id}` : '';

  if (scope === 'cell') {
    if (!user.cell_id) return null;
    return { query: `cell_id=eq.${user.cell_id}` };
  }

  if (scope === 'fellowship') {
    if (!user.fellowship_id) return null;
    const cellsRes = await fetch(`${SUPABASE_URL}/rest/v1/cells?fellowship_id=eq.${user.fellowship_id}${churchFilter}&select=id`, { headers: hdrs() });
    const cells = await cellsRes.json().catch(() => []);
    const cellIds = (Array.isArray(cells) ? cells : []).map((c: { id: string }) => c.id);
    if (cellIds.length === 0) return null;
    return { query: `cell_id=in.(${cellIds.join(',')})` };
  }

  if (scope === 'department') {
    const deptRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: hdrs() });
    const deptData = await deptRes.json().catch(() => []);
    const departmentId = deptData?.[0]?.department_id;
    if (!departmentId) return null;
    const membersRes = await fetch(`${SUPABASE_URL}/rest/v1/department_members?department_id=eq.${departmentId}&select=member_id`, { headers: hdrs() });
    const rows = await membersRes.json().catch(() => []);
    const memberIds = [...new Set((Array.isArray(rows) ? rows : []).map((r: { member_id: string }) => r.member_id).filter(Boolean))];
    if (memberIds.length === 0) return null;
    return { query: `id=in.(${memberIds.join(',')})` };
  }

  // scope === 'all' — church-wide, or branch-scoped for a branch_pastor
  // (mandatorily scoped, same as everywhere else this role appears).
  if (user.role === 'branch_pastor') {
    if (!user.branch_id) return null;
    return { query: `branch_id=eq.${user.branch_id}${churchFilter}` };
  }
  return { query: `1=eq.1${churchFilter}` };
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'cell';

    const resolved = await resolveMemberIds(user, scope);
    if (!resolved) return NextResponse.json({ data: { today: [], upcoming: [], thisMonth: [] }, error: null });

    const membersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?${resolved.query}&membership_status=eq.active&date_of_birth=not.is.null&select=id,full_name,date_of_birth,cell_id&order=full_name.asc`,
      { headers: hdrs() }
    );
    const memberRows: MemberRow[] = await membersRes.json().catch(() => []);
    const members = Array.isArray(memberRows) ? memberRows : [];

    const cellIds = [...new Set(members.map(m => m.cell_id).filter(Boolean))] as string[];
    const cellsById = await fetchCellsWithFellowship(cellIds);

    const today = new Date();
    const out = { today: [] as Record<string, unknown>[], upcoming: [] as Record<string, unknown>[], thisMonth: [] as Record<string, unknown>[] };

    for (const m of members) {
      if (!m.date_of_birth) continue;
      const b = computeBirthday(m.date_of_birth, today);
      const cell = m.cell_id ? cellsById[m.cell_id] : undefined;
      const base = {
        id: m.id,
        full_name: m.full_name,
        date_of_birth: m.date_of_birth,
        birth_month: b.birth_month,
        birth_day: b.birth_day,
        cell_name: cell?.name || '—',
        fellowship_name: cell?.fellowship_name || '—',
        is_today: b.is_today,
        is_this_month: b.is_this_month,
      };

      if (b.is_today) out.today.push({ ...base, days_until: 0, age_turning: b.age_turning_this_year });
      if (b.days_until_upcoming >= 1 && b.days_until_upcoming <= 30) out.upcoming.push({ ...base, days_until: b.days_until_upcoming, age_turning: b.age_turning_upcoming });
      if (b.is_this_month) out.thisMonth.push({ ...base, days_until: b.days_until_this_year, age_turning: b.age_turning_this_year });
    }

    out.upcoming.sort((a, b) => (a.days_until as number) - (b.days_until as number));
    out.thisMonth.sort((a, b) => (a.days_until as number) - (b.days_until as number));

    return NextResponse.json({ data: out, error: null });
  } catch (err) {
    console.error('[GET /api/birthdays]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load birthdays' } }, { status: 500 });
  }
}

async function getUser(req: Request) {
  return getAuthUser(req);
}
