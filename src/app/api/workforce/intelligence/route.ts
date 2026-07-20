import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const [deptRes, rosterRes, memberRes, profileRes] = await Promise.all([
      fetch(`${SURL}/rest/v1/departments?select=id,name`, { headers: H() }),
      fetch(`${SURL}/rest/v1/workforce_rosters?order=service_date.desc&limit=100&select=id,department_id,service_date,published,workforce_roster_entries(id,member_id,member_name,role_title,confirmed)`, { headers: H() }),
      fetch(`${SURL}/rest/v1/department_members?select=department_id,member_id,members(full_name,membership_status)`, { headers: H() }),
      fetch(`${SURL}/rest/v1/workforce_profiles?select=id,member_id,primary_department_id,secondary_departments,reliability_score,total_services_assigned,total_services_attended,last_served,is_active,members(full_name)`, { headers: H() }),
    ]);

    const [depts, rosters, deptMembers, profiles] = await Promise.all([
      deptRes.json(), rosterRes.json(), memberRes.json(), profileRes.json(),
    ]);

    const departments = Array.isArray(depts) ? depts : [];
    const allRosters = Array.isArray(rosters) ? rosters : [];
    const allDeptMembers = Array.isArray(deptMembers) ? deptMembers : [];
    const allProfiles = Array.isArray(profiles) ? profiles : [];

    // Compute per-department stats
    const today = new Date().toISOString().split('T')[0];
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()) % 7 || 7);
    const nextSundayStr = nextSunday.toISOString().split('T')[0];

    const departmentStats = departments.map((dept: Record<string,unknown>) => {
      const deptRosters = allRosters.filter((r: Record<string,unknown>) => r.department_id === dept.id);
      const memberCount = allDeptMembers.filter((m: Record<string,unknown>) => m.department_id === dept.id).length;
      const nextRoster = deptRosters.find((r: Record<string,unknown>) => r.service_date >= today);
      const entries = (nextRoster as Record<string,unknown[]>|null)?.workforce_roster_entries || [];
      const coverage = entries.length > 0 ? 'scheduled' : 'no_roster';
      const lastRoster = deptRosters[0];
      return {
        id: dept.id, name: dept.name, member_count: memberCount,
        next_roster_date: nextRoster ? (nextRoster as Record<string,unknown>).service_date : null,
        next_roster_coverage: coverage, roster_count: deptRosters.length,
        last_roster_date: lastRoster ? (lastRoster as Record<string,unknown>).service_date : null,
        assigned_next: entries.length,
      };
    });

    // Overcommitted members (in 3+ departments)
    const memberDeptMap: Record<string, string[]> = {};
    allDeptMembers.forEach((dm: Record<string,unknown>) => {
      const mid = dm.member_id as string;
      if (!memberDeptMap[mid]) memberDeptMap[mid] = [];
      memberDeptMap[mid].push(dm.department_id as string);
    });
    const overcommitted = Object.entries(memberDeptMap)
      .filter(([, depts]) => depts.length >= 3)
      .map(([member_id, dept_ids]) => ({ member_id, department_count: dept_ids.length }))
      .slice(0, 10);

    // Reliability rankings
    const ranked = [...allProfiles]
      .sort((a: Record<string,unknown>, b: Record<string,unknown>) => (b.reliability_score as number) - (a.reliability_score as number))
      .slice(0, 10)
      .map((p: Record<string,unknown>) => ({
        member_id: p.member_id,
        full_name: (p.members as Record<string,string>|null)?.full_name || 'Unknown',
        reliability_score: p.reliability_score,
        total_assigned: p.total_services_assigned,
        total_attended: p.total_services_attended,
        last_served: p.last_served,
      }));

    // Summary stats
    const totalWorkforce = new Set(allDeptMembers.map((m: Record<string,unknown>) => m.member_id)).size;
    const deptsCovered = departmentStats.filter(d => d.next_roster_coverage === 'scheduled').length;
    const deptsWithGaps = departmentStats.filter(d => d.next_roster_coverage === 'no_roster').length;

    return NextResponse.json({
      data: {
        summary: {
          total_workforce: totalWorkforce,
          total_departments: departments.length,
          departments_scheduled_next_sunday: deptsCovered,
          departments_with_gaps: deptsWithGaps,
          overcommitted_members: overcommitted.length,
        },
        department_stats: departmentStats,
        overcommitted,
        reliability_rankings: ranked,
        next_sunday: nextSundayStr,
      },
      error: null,
    });
  } catch (e) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load workforce intelligence' } }, { status: 500 });
  }
}
