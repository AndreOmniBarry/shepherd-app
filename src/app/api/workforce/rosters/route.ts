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
    const { searchParams } = new URL(req.url);
    const dept_id = searchParams.get('department_id');
    const date = searchParams.get('date');
    let url = `${SURL}/rest/v1/workforce_rosters?order=service_date.desc&limit=20&select=id,department_id,service_date,service_type,published,created_at`;
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
        const userRes = await fetch(`${SURL}/rest/v1/users?select=id,email`, { headers: H() });
        const users = await userRes.json();
        const notifications = (entries || []).filter((e: Record<string,unknown>) => e.member_id).map((e: Record<string,unknown>) => ({
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
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
