export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Church Center — every personal thing that used to be scattered across
// the notification bell and a bare "My Assignments" page, in one tabbed
// home: recognition received, meeting requests (sent and received),
// order-of-service assignments, and workforce roster assignments.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [commendationsRes, meetingsRes, planItemsRes, rosterEntriesRes] = await Promise.all([
      fetch(`${SURL}/rest/v1/notifications?user_id=eq.${user.id}&type=eq.commendation&order=created_at.desc&limit=50&select=id,title,body,read,created_at`, { headers: H() }),
      fetch(`${SURL}/rest/v1/meeting_requests?or=(requested_by.eq.${user.id},requested_of.eq.${user.id})&order=created_at.desc&limit=50&select=id,subject,message,proposed_time,status,created_at,responded_at,requested_by,requested_of,requester:requested_by(full_name),recipient:requested_of(full_name)`, { headers: H() }),
      fetch(`${SURL}/rest/v1/service_plan_items?assigned_to=eq.${user.id}&select=id,item_type,title,description,duration_minutes,is_completed,service_plans!inner(id,service_date,title,theme,status)&service_plans.status=eq.published&service_plans.service_date=gte.${cutoff}`, { headers: H() }),
      fetch(`${SURL}/rest/v1/workforce_roster_entries?member_id=eq.${user.id}&select=id,role_title,position,confirmed,workforce_rosters!inner(id,service_date,service_type,published,departments(name))&workforce_rosters.published=eq.true&workforce_rosters.service_date=gte.${cutoff}`, { headers: H() }),
    ]);
    const commendationsData = await commendationsRes.json().catch(() => []);
    const meetingsData = await meetingsRes.json().catch(() => []);
    const planItems = await planItemsRes.json().catch(() => []);
    const rosterEntries = await rosterEntriesRes.json().catch(() => []);

    const commendations = Array.isArray(commendationsData) ? commendationsData : [];

    const meetingRequests = (Array.isArray(meetingsData) ? meetingsData : []).map((m: Record<string, unknown>) => ({
      id: m.id, subject: m.subject, message: m.message, proposed_time: m.proposed_time,
      status: m.status, created_at: m.created_at, responded_at: m.responded_at,
      direction: m.requested_by === user.id ? 'sent' : 'received',
      other_party: m.requested_by === user.id ? (m.recipient as Record<string, string>)?.full_name : (m.requester as Record<string, string>)?.full_name,
    }));

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

    return NextResponse.json({
      data: { commendations, meeting_requests: meetingRequests, service_assignments: serviceAssignments, workforce_assignments: workforceAssignments },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/church-center]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load Church Center' } }, { status: 500 });
  }
}
