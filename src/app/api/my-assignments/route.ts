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

// Everything the logged-in person has personally been assigned — order of
// service roles and workforce roster slots — in one place. Every publish
// notification for both of those tells the recipient to "check My
// Assignments"; this is that page's data, which never existed until now.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [planItemsRes, rosterEntriesRes] = await Promise.all([
      fetch(`${SURL}/rest/v1/service_plan_items?assigned_to=eq.${user.id}&select=id,item_type,title,description,duration_minutes,is_completed,service_plans!inner(id,service_date,title,theme,status)&service_plans.status=eq.published&service_plans.service_date=gte.${cutoff}`, { headers: H() }),
      fetch(`${SURL}/rest/v1/workforce_roster_entries?member_id=eq.${user.id}&select=id,role_title,position,confirmed,workforce_rosters!inner(id,service_date,service_type,published,departments(name))&workforce_rosters.published=eq.true&workforce_rosters.service_date=gte.${cutoff}`, { headers: H() }),
    ]);
    const planItems = await planItemsRes.json().catch(() => []);
    const rosterEntries = await rosterEntriesRes.json().catch(() => []);

    const serviceAssignments = (Array.isArray(planItems) ? planItems : []).map((it: Record<string, unknown>) => {
      const plan = it.service_plans as Record<string, unknown>;
      return {
        id: it.id, item_type: it.item_type, title: it.title, description: it.description,
        duration_minutes: it.duration_minutes, is_completed: it.is_completed,
        service_date: plan?.service_date, service_title: plan?.title, service_theme: plan?.theme,
      };
    }).sort((a, b) => String(a.service_date).localeCompare(String(b.service_date)));

    const workforceAssignments = (Array.isArray(rosterEntries) ? rosterEntries : []).map((e: Record<string, unknown>) => {
      const roster = e.workforce_rosters as Record<string, unknown>;
      const dept = roster?.departments as Record<string, string> | null;
      return {
        id: e.id, role_title: e.role_title, position: e.position, confirmed: e.confirmed,
        service_date: roster?.service_date, service_type: roster?.service_type, department_name: dept?.name || 'Department',
      };
    }).sort((a, b) => String(a.service_date).localeCompare(String(b.service_date)));

    return NextResponse.json({ data: { service_assignments: serviceAssignments, workforce_assignments: workforceAssignments }, error: null });
  } catch (err) {
    console.error('[GET /api/my-assignments]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load assignments' } }, { status: 500 });
  }
}
