export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { gradeToScore } from '@/lib/sla';
import { resolveBranchScope } from '@/lib/branch-scope';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Care & Follow-up engagement, for the pastor/PA dashboard — a real-time
// view of what the care team is actually working: first-timer follow-up
// and absentee restoration, who's carrying what load, and how promptly
// each is being closed out. Everything here is read from the same
// first_timers/care_leads tables the care team's own portal writes to.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const { branchFilter, forbidden } = resolveBranchScope(user, searchParams);
    if (forbidden) {
      return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
    }

    const churchFilter = `&church_id=eq.${user.church_id}`;
    const [teamRes, timersRes, leadsRes] = await Promise.all([
      fetch(`${SURL}/rest/v1/users?role=eq.care_team&select=id,full_name,is_active${branchFilter}${churchFilter}`, { headers: H() }),
      fetch(`${SURL}/rest/v1/first_timers?order=created_at.desc&limit=300&select=id,full_name,status,outcome,assigned_to,sla_grade,created_at,service_date${branchFilter}${churchFilter}`, { headers: H() }),
      fetch(`${SURL}/rest/v1/care_leads?order=created_at.desc&limit=300&select=id,weeks_absent,status,assigned_to,sla_grade,created_at,members(full_name)${branchFilter}${churchFilter}`, { headers: H() }),
    ]);
    const team = await teamRes.json();
    const timers = await timersRes.json();
    const leads = await leadsRes.json();

    const teamRows: { id: string; full_name: string; is_active: boolean }[] = Array.isArray(team) ? team : [];
    const timerRows: Record<string, unknown>[] = Array.isArray(timers) ? timers : [];
    const leadRows: Record<string, unknown>[] = Array.isArray(leads) ? leads : [];

    const nameOf = (id: string | null) => teamRows.find(m => m.id === id)?.full_name || 'Unassigned';

    const timerCounts = { new: 0, contacted: 0, follow_up: 0, converted: 0, declined: 0, other: 0 };
    timerRows.forEach(r => {
      const s = (r.outcome || r.status) as string;
      if (s in timerCounts) (timerCounts as Record<string, number>)[s]++;
      else timerCounts.other++;
    });

    const leadCounts = { in_progress: 0, reached: 0, visited: 0, restored: 0, unreachable: 0, closed: 0, other: 0 };
    leadRows.forEach(r => {
      const s = r.status as string;
      if (s in leadCounts) (leadCounts as Record<string, number>)[s]++;
      else leadCounts.other++;
    });

    // Per-care-team-member workload and promptness — same composite-score
    // pattern used for cell leader recognition, applied to care team.
    const memberStats: Record<string, { assigned: number; resolved: number; slaScores: number[] }> = {};
    teamRows.forEach(m => { memberStats[m.id] = { assigned: 0, resolved: 0, slaScores: [] }; });
    const RESOLVED_TIMER = new Set(['converted', 'declined']);
    const RESOLVED_LEAD = new Set(['restored', 'unreachable', 'closed']);
    timerRows.forEach(r => {
      const aid = r.assigned_to as string | null;
      if (!aid || !memberStats[aid]) return;
      memberStats[aid].assigned++;
      const s = (r.outcome || r.status) as string;
      if (RESOLVED_TIMER.has(s)) memberStats[aid].resolved++;
      const score = gradeToScore(r.sla_grade as string | null);
      if (score !== null) memberStats[aid].slaScores.push(score);
    });
    leadRows.forEach(r => {
      const aid = r.assigned_to as string | null;
      if (!aid || !memberStats[aid]) return;
      memberStats[aid].assigned++;
      if (RESOLVED_LEAD.has(r.status as string)) memberStats[aid].resolved++;
      const score = gradeToScore(r.sla_grade as string | null);
      if (score !== null) memberStats[aid].slaScores.push(score);
    });

    const roster = teamRows.map(m => {
      const s = memberStats[m.id];
      const avgSla = s.slaScores.length > 0 ? Math.round(s.slaScores.reduce((a, b) => a + b, 0) / s.slaScores.length) : null;
      return { id: m.id, full_name: m.full_name, is_active: m.is_active, assigned: s.assigned, resolved: s.resolved, avg_sla_score: avgSla };
    }).sort((a, b) => b.assigned - a.assigned);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentFirstTimers = timerRows.slice(0, 20).map(r => ({
      id: r.id, full_name: r.full_name, status: (r.outcome || r.status) as string,
      assigned_name: nameOf(r.assigned_to as string | null), sla_grade: r.sla_grade, created_at: r.created_at,
    }));
    const recentLeads = leadRows.slice(0, 20).map(r => ({
      id: r.id, member_name: (r.members as Record<string, string> | null)?.full_name || 'Unknown',
      weeks_absent: r.weeks_absent, status: r.status,
      assigned_name: nameOf(r.assigned_to as string | null), sla_grade: r.sla_grade, created_at: r.created_at,
    }));

    return NextResponse.json({
      data: {
        summary: {
          total_first_timers: timerRows.length,
          new_first_timers_30d: timerRows.filter(r => new Date(r.created_at as string) >= thirtyDaysAgo).length,
          total_absentee_leads: leadRows.length,
          restored_30d: leadRows.filter(r => r.status === 'restored' && new Date(r.created_at as string) >= thirtyDaysAgo).length,
        },
        timer_counts: timerCounts,
        lead_counts: leadCounts,
        roster,
        recent_first_timers: recentFirstTimers,
        recent_leads: recentLeads,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/care/overview]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load care overview' } }, { status: 500 });
  }
}
