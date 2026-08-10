import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { resolveBranchScope } from '@/lib/branch-scope';

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1] || req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer','general_overseer','branch_pastor','pa','lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

    // Branch scoping: a branch_pastor is always locked to their own branch.
    // general_overseer/overseer/pa/lead_tech can pass ?branch_id= to drill
    // into one branch, or omit it for the consolidated all-branches view.
    const { searchParams } = new URL(req.url);
    const { branchFilter, forbidden } = resolveBranchScope(user, searchParams);
    if (forbidden) {
      return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
    }
    const churchFilter = `&church_id=eq.${user.church_id}`;

    const [members, activeCells, ytdGiving, newMembers] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/members?select=membership_status,join_date,gender,date_of_birth${branchFilter}${churchFilter}`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/cells?is_active=eq.true&select=id${branchFilter}${churchFilter}`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/income_records?created_at=gte.${new Date().getFullYear()}-01-01T00:00:00&select=amount,income_type_id,income_types(name,category)${branchFilter}${churchFilter}`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/members?join_date=gte.${getFirstOfMonth()}&membership_status=eq.active&select=id${branchFilter}${churchFilter}`, { headers }).then(r => r.json()),
    ]);

    // Attendance doesn't carry branch_id directly — it's scoped via the
    // cells that were just fetched for this branch.
    const cellIds = (Array.isArray(activeCells) ? activeCells : []).map((c: { id: string }) => c.id);
    const todayAttendance = cellIds.length > 0
      ? await fetch(`${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${getMostRecentSunday()}&cell_id=in.(${cellIds.join(',')})&select=present_count,visitor_count,cell_id`, { headers }).then(r => r.json())
      : [];

    const totalMembers = Array.isArray(members) ? members.length : 0;
    const activeMembers = Array.isArray(members) ? members.filter((m: Record<string,string>) => m.membership_status === 'active').length : 0;
    const activeCellsCount = Array.isArray(activeCells) ? activeCells.length : 0;
    const todayPresent = Array.isArray(todayAttendance) ? todayAttendance.reduce((s: number, r: Record<string,number>) => s + (r.present_count || 0) + (r.visitor_count || 0), 0) : 0;
    const cellsReported = Array.isArray(todayAttendance) ? new Set(todayAttendance.map((r: Record<string,string>) => r.cell_id)).size : 0;
    const ytdTotal = Array.isArray(ytdGiving) ? ytdGiving.reduce((s: number, r: Record<string,number>) => s + Number(r.amount || 0), 0) : 0;
    const newMembersCount = Array.isArray(newMembers) ? newMembers.length : 0;

    // ── Giving breakdown by category (Tithe/Offering/etc), real YTD totals ──
    const categoryTotals: Record<string, number> = {};
    if (Array.isArray(ytdGiving)) {
      for (const r of ytdGiving as Record<string, unknown>[]) {
        const cat = (r.income_types as Record<string,string>|null)?.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(r.amount || 0);
      }
    }
    const givingBreakdown = Object.entries(categoryTotals)
      .map(([name, amount]) => ({ name, amount: Math.round(amount), pct: ytdTotal > 0 ? Math.round((amount / ytdTotal) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount);

    // ── Gender distribution — real counts, unknown/blank excluded rather than guessed ──
    const genderCounts: Record<string, number> = {};
    let genderKnown = 0;
    if (Array.isArray(members)) {
      for (const m of members as Record<string, string>[]) {
        if (m.gender) { genderCounts[m.gender] = (genderCounts[m.gender] || 0) + 1; genderKnown++; }
      }
    }
    const genderDistribution = Object.entries(genderCounts).map(([name, n]) => ({ name, count: n, pct: genderKnown > 0 ? Math.round((n / genderKnown) * 100) : 0 }));

    // ── Age bands from date_of_birth — members with no DOB on file are simply
    // excluded (not guessed into a band), so this fills in accurately as DOB
    // data is completed rather than showing a fake distribution up front ──
    const AGE_BANDS = [
      { label: '0–12', min: 0, max: 12 }, { label: '13–19', min: 13, max: 19 },
      { label: '20–25', min: 20, max: 25 }, { label: '26–35', min: 26, max: 35 },
      { label: '36–50', min: 36, max: 50 }, { label: '51+', min: 51, max: 200 },
    ];
    const ageBandCounts = AGE_BANDS.map(b => ({ band: b.label, n: 0 }));
    let ageKnown = 0;
    const now = new Date();
    if (Array.isArray(members)) {
      for (const m of members as Record<string, string>[]) {
        if (!m.date_of_birth) continue;
        const dob = new Date(m.date_of_birth);
        if (Number.isNaN(dob.getTime())) continue;
        let age = now.getFullYear() - dob.getFullYear();
        const hasHadBirthdayThisYear = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
        if (!hasHadBirthdayThisYear) age--;
        const bandIdx = AGE_BANDS.findIndex(b => age >= b.min && age <= b.max);
        if (bandIdx !== -1) { ageBandCounts[bandIdx].n++; ageKnown++; }
      }
    }
    const ageBands = ageBandCounts.map(b => ({ ...b, p: ageKnown > 0 ? Math.round((b.n / ageKnown) * 100) : 0 }));

    // ── Member growth trend — cumulative count at the end of each of the last 6 months ──
    const growthTrend: { month: string; count: number }[] = [];
    if (Array.isArray(members)) {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i, 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const count = members.filter((m: Record<string, string>) => m.join_date && new Date(m.join_date) < endOfMonth).length;
        growthTrend.push({ month: d.toLocaleString('en-US', { month: 'short' }), count });
      }
    }

    return NextResponse.json({
      data: {
        total_members: totalMembers,
        active_members: activeMembers,
        today_present: todayPresent,
        today_cells_reported: cellsReported,
        today_cells_total: activeCellsCount,
        ytd_giving_ngn: Math.round(ytdTotal),
        active_cells: activeCellsCount,
        new_members_month: newMembersCount,
        growth_trend: growthTrend,
        giving_breakdown: givingBreakdown,
        gender_distribution: genderDistribution,
        gender_known: genderKnown,
        age_bands: ageBands,
        age_known: ageKnown,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/analytics/dashboard]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 });
  }
}

function getMostRecentSunday() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function getFirstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
