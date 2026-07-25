export const dynamic = 'force-dynamic';
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

async function ownDepartmentId(userId: string): Promise<string | null> {
  const res = await fetch(`${SURL}/rest/v1/users?id=eq.${userId}&select=department_id&limit=1`, { headers: H() });
  const data = await res.json();
  return data?.[0]?.department_id || null;
}

// Department head's own serving-roster tab — same workforce_rosters/
// workforce_roster_entries tables the admin Workforce Intelligence view
// reads from, but self-scoped to the caller's own department (like every
// other /api/department/* route) instead of taking department_id from the
// client.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'department_head') return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    const department_id = await ownDepartmentId(user.id);
    if (!department_id) return NextResponse.json({ data: { rosters: [], members: [] }, error: null });

    const [rostersRes, membersRes] = await Promise.all([
      fetch(`${SURL}/rest/v1/workforce_rosters?department_id=eq.${department_id}&order=service_date.desc&limit=12&select=id,service_date,service_type,published,created_at`, { headers: H() }),
      fetch(`${SURL}/rest/v1/department_members?department_id=eq.${department_id}&select=member_id,members(id,full_name,phone)`, { headers: H() }),
    ]);
    const rosters = await rostersRes.json();
    const membersData = await membersRes.json();

    const withEntries = await Promise.all((Array.isArray(rosters) ? rosters : []).map(async (r: Record<string,unknown>) => {
      const er = await fetch(`${SURL}/rest/v1/workforce_roster_entries?roster_id=eq.${r.id}&order=role_title.asc&select=id,member_id,member_name,role_title,position,confirmed`, { headers: H() });
      const entries = await er.json();
      return { ...r, entries: Array.isArray(entries) ? entries : [] };
    }));

    const members = (Array.isArray(membersData) ? membersData : [])
      .map((dm: Record<string,unknown>) => dm.members as {id:string;full_name:string;phone:string|null}|null)
      .filter(Boolean);

    return NextResponse.json({ data: { rosters: withEntries, members }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed to load roster' } }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'department_head') return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    const department_id = await ownDepartmentId(user.id);
    if (!department_id) return NextResponse.json({ data: null, error: { message: 'No department assigned to your account' } }, { status: 400 });

    const { service_date, service_type, entries, publish } = await req.json();
    if (!service_date) return NextResponse.json({ data: null, error: { message: 'service_date is required' } }, { status: 400 });

    const rRes = await fetch(`${SURL}/rest/v1/workforce_rosters`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({ department_id, service_date, service_type: service_type || 'sunday', created_by: user.id, published: publish || false, updated_at: new Date().toISOString() }),
    });
    const rData = await rRes.json();
    const roster = Array.isArray(rData) ? rData[0] : rData;
    if (!roster?.id) return NextResponse.json({ data: null, error: { message: 'Failed to save roster' } }, { status: 500 });

    if (entries) {
      await fetch(`${SURL}/rest/v1/workforce_roster_entries?roster_id=eq.${roster.id}`, { method: 'DELETE', headers: H() });
      if (entries.length > 0) {
        const rows = entries.map((e: Record<string,unknown>) => ({ ...e, roster_id: roster.id, confirmed: false }));
        await fetch(`${SURL}/rest/v1/workforce_roster_entries`, { method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(rows) });
      }
    }

    if (publish && entries?.length > 0) {
      const deptRes = await fetch(`${SURL}/rest/v1/departments?id=eq.${department_id}&select=name&limit=1`, { headers: H() });
      const deptData = await deptRes.json();
      const deptName = deptData?.[0]?.name || 'Department';
      const memberIds = [...new Set((entries as Record<string,unknown>[]).map(e => e.member_id).filter(Boolean))];
      if (memberIds.length > 0) {
        const userRes = await fetch(`${SURL}/rest/v1/users?id=in.(${memberIds.join(',')})&select=id`, { headers: H() });
        const users = await userRes.json();
        const userIds = new Set(Array.isArray(users) ? users.map((u: Record<string,string>) => u.id) : []);
        const notifications = (entries as Record<string,unknown>[]).filter(e => e.member_id && userIds.has(e.member_id as string)).map(e => ({
          user_id: e.member_id, type: 'service', read: false,
          title: `You are on the ${deptName} rota`,
          body: `${service_date} · Your role: ${e.role_title}${e.position ? ` — ${e.position}` : ''}. Check My Assignments.`,
        }));
        if (notifications.length > 0) {
          await fetch(`${SURL}/rest/v1/notifications`, { method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(notifications) });
        }
      }
    }

    return NextResponse.json({ data: { roster }, error: null }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed to save roster' } }, { status: 500 }); }
}
