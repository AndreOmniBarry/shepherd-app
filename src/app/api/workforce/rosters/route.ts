export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { notifyMany } from '@/lib/notify';

// A note for anyone tempted to add "roster-publishing promptness" to the
// department-head leadership SLA (src/lib/leadership-sla.ts,
// computeDepartmentHeadScore): it was investigated for that ticket and
// deliberately left out. workforce_rosters (see scripts/05_service_planner
// .sql) only has created_at (first save, draft or published) and
// updated_at (rewritten on every save) — there is no published_at that
// isolates the moment `published` actually flipped to true. Department
// heads commonly save a draft roster, edit it over several days, and
// publish later (see POST below and src/app/api/department/roster/
// route.ts) — sometimes editing further *after* publishing (swapping a
// server, say). Using updated_at as a stand-in would silently mismeasure
// promptness for that last case (a roster published on time but tweaked
// afterward would look late) rather than just being imprecise, so it was
// dropped instead of forced in as a fake signal. Revisit if a real
// published_at column is ever added to this table.

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const dept_id = searchParams.get('department_id');
    const date = searchParams.get('date');

    // workforce_rosters carries no church_id of its own — scope it via the
    // departments that belong to this caller's church, otherwise the
    // unfiltered listing would leak every church's rosters.
    const deptsRes = await fetch(`${SURL}/rest/v1/departments?church_id=eq.${user.church_id}&select=id`, { headers: H() });
    const deptRows: { id: string }[] = await deptsRes.json();
    const deptIds = (Array.isArray(deptRows) ? deptRows : []).map(d => d.id);
    if (dept_id && !deptIds.includes(dept_id)) {
      return NextResponse.json({ data: { rosters: [] }, error: null });
    }
    const deptFilter = dept_id ? '' : (deptIds.length > 0 ? `&department_id=in.(${deptIds.join(',')})` : '&department_id=eq.00000000-0000-0000-0000-000000000000');

    let url = `${SURL}/rest/v1/workforce_rosters?order=service_date.desc&limit=20&select=id,department_id,service_date,service_type,published,created_at${deptFilter}`;
    if (dept_id) url += `&department_id=eq.${dept_id}`;
    if (date) url += `&service_date=eq.${date}`;
    const res = await fetch(url, { headers: H() });
    const rosters = await res.json();
    // Get entries for each roster
    const withEntries = await Promise.all((Array.isArray(rosters) ? rosters : []).map(async (r: Record<string,unknown>) => {
      const er = await fetch(`${SURL}/rest/v1/workforce_roster_entries?roster_id=eq.${r.id}&order=role_title.asc&select=id,member_id,member_name,role_title,position,confirmed`, { headers: H() });
      const entries = await er.json();
      return { ...r, entries: Array.isArray(entries) ? entries : [] };
    }));
    return NextResponse.json({ data: { rosters: withEntries }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['overseer','pa','lead_tech','department_head'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    const { department_id, service_date, service_type, entries, publish } = await req.json();
    if (!department_id || !service_date) return NextResponse.json({ data: null, error: { message: 'department_id and service_date required' } }, { status: 400 });

    // workforce_rosters has no church_id of its own — verify the
    // department itself belongs to this caller's church before touching it.
    const deptCheckRes = await fetch(`${SURL}/rest/v1/departments?id=eq.${department_id}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
    const deptCheck = await deptCheckRes.json();
    if (!deptCheck?.[0]) return NextResponse.json({ data: null, error: { message: 'Department not found' } }, { status: 404 });

    // A department_head could otherwise publish a roster (and send
    // notifications) for ANY department in their own church, not just the
    // one they actually head — a same-tenant authorization gap, not a
    // cross-church one (see MULTI_TENANT_AUDIT.md). department_id isn't on
    // the JWT, so it's looked up fresh here rather than trusted from the
    // token.
    if (user.role === 'department_head') {
      const ownDeptRes = await fetch(`${SURL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: H() });
      const ownDept = await ownDeptRes.json();
      if (ownDept?.[0]?.department_id !== department_id) {
        return NextResponse.json({ data: null, error: { message: 'You can only manage the roster for the department you head' } }, { status: 403 });
      }
    }

    // Upsert roster
    const rRes = await fetch(`${SURL}/rest/v1/workforce_rosters`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({ department_id, service_date, service_type: service_type || 'sunday', created_by: user.id, published: publish || false, updated_at: new Date().toISOString() }),
    });
    const rData = await rRes.json();
    const roster = Array.isArray(rData) ? rData[0] : rData;

    if (entries?.length > 0) {
      await fetch(`${SURL}/rest/v1/workforce_roster_entries?roster_id=eq.${roster.id}`, { method: 'DELETE', headers: H() });
      const rows = entries.map((e: Record<string,unknown>) => ({ ...e, roster_id: roster.id, confirmed: false }));
      await fetch(`${SURL}/rest/v1/workforce_roster_entries`, { method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(rows) });
    }

    // If publishing, notify assigned members
    if (publish) {
      const today = new Date().toISOString().split('T')[0];
      const deptRes = await fetch(`${SURL}/rest/v1/departments?id=eq.${department_id}&select=name&limit=1`, { headers: H() });
      const deptData = await deptRes.json();
      const deptName = deptData?.[0]?.name || 'Department';
      const memberIds = [...new Set((entries || []).map((e: Record<string,unknown>) => e.member_id).filter(Boolean))];
      if (memberIds.length > 0) {
        // Members and users are separate tables — only member_ids that also have a
        // users row (same id, i.e. that member has a login account) can be notified.
        const userRes = await fetch(`${SURL}/rest/v1/users?id=in.(${memberIds.join(',')})&select=id`, { headers: H() });
        const users = await userRes.json();
        const userIds = new Set(Array.isArray(users) ? users.map((u: Record<string,string>) => u.id) : []);
        const notifyRows = (entries || []).filter((e: Record<string,unknown>) => e.member_id && userIds.has(e.member_id)).map((e: Record<string,unknown>) => ({
          userId: e.member_id as string,
          content: {
            type: 'service',
            title: `You are on the ${deptName} rota`,
            body: `${service_date} · Your role: ${e.role_title}${e.position ? ` — ${e.position}` : ''}. Check My Assignments.`,
            link: '/church-center?tab=assignments',
          },
        }));
        await notifyMany(notifyRows, user.church_id);
      }
    }
    return NextResponse.json({ data: { roster }, error: null }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
