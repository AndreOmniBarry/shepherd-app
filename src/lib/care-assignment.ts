export { computeSlaGrade } from '@/lib/sla';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

// Smart care-team assignment: whoever currently has the fewest open items
// (care_leads + first_timers combined) gets the next one. Replaces plain
// round-robin, which ignores backlog — round-robin alone means someone
// sitting on 15 old open leads keeps getting new ones at the same rate as
// someone with 2, which isn't actually "smart" load balancing.
//
// EXCLUDE_DEMO_IDS matters far more here than in a display list: the fixed
// "DEMO — care team" preview account (see /api/admin/impersonate) is a
// real, active, church_id-matching users row the instant anyone has ever
// previewed that portal — and it always starts at zero assigned load, so
// without this filter it wins "least loaded" almost every time, silently
// routing a real first-timer or absentee lead to an account nobody
// actually monitors. Worse un-excluded: a church with no real care_team
// staff yet but one preview click would hit the careIds.length===1 short
// circuit below and assign every single one of them to the demo account.
export async function assignToLeastLoadedCareTeamMember(
  SUPABASE_URL: string,
  hdrs: Record<string, string>,
  churchId: string | null | undefined
): Promise<string | null> {
  if (!churchId) return null;
  const teamRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.care_team&is_active=eq.true&church_id=eq.${churchId}${EXCLUDE_DEMO_IDS}&select=id`, { headers: hdrs });
  const team = await teamRes.json();
  const careIds: string[] = Array.isArray(team) ? team.map((u: { id: string }) => u.id) : [];
  if (careIds.length === 0) return null;
  if (careIds.length === 1) return careIds[0];

  const [leadsRes, timersRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/care_leads?status=in.(new,in_progress,reached,visited)&church_id=eq.${churchId}&select=assigned_to`, { headers: hdrs }),
    fetch(`${SUPABASE_URL}/rest/v1/first_timers?status=in.(new,contacted,follow_up)&church_id=eq.${churchId}&select=assigned_to`, { headers: hdrs }),
  ]);
  const leads = await leadsRes.json();
  const timers = await timersRes.json();

  const load: Record<string, number> = {};
  careIds.forEach(id => { load[id] = 0; });
  [...(Array.isArray(leads) ? leads : []), ...(Array.isArray(timers) ? timers : [])].forEach((row: { assigned_to: string | null }) => {
    if (row.assigned_to && row.assigned_to in load) load[row.assigned_to]++;
  });

  return careIds.reduce((least, id) => (load[id] < load[least] ? id : least), careIds[0]);
}
