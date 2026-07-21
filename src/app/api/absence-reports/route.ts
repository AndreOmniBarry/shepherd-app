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

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'all';
    let url = `${SURL}/rest/v1/absence_reports?order=created_at.desc&limit=100&select=*`;
    if (scope === 'fellowship' && user.fellowship_id) url += `&fellowship_id=eq.${user.fellowship_id}`;
    if (scope === 'mine') url += `&submitted_by=eq.${user.id}`;
    const res = await fetch(url, { headers: H() });
    const reports = await res.json();
    return NextResponse.json({ data: { reports: Array.isArray(reports) ? reports : [] }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const body = await req.json();
    const { member_id, member_name, service_date, reason, reason_detail, requires_followup, followup_scope, outreach_efforts } = body;
    if (!member_name || !service_date || !reason) return NextResponse.json({ data: null, error: { message: 'member_name, service_date and reason are required' } }, { status: 400 });
    const res = await fetch(`${SURL}/rest/v1/absence_reports`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ member_id: member_id||null, member_name, service_date, reason, reason_detail: reason_detail||null, requires_followup: requires_followup||false, followup_scope: followup_scope||null, outreach_efforts: outreach_efforts||null, fellowship_id: user.fellowship_id||null, submitted_by: user.id, submitted_by_name: user.name, followup_status: requires_followup ? 'pending' : 'no_action' }),
    });
    const data = await res.json();
    const report = Array.isArray(data) ? data[0] : data;
    const notifyRoles = requires_followup ? ['fellowship_head','care_team','pa','overseer'] : ['fellowship_head','pa'];
    for (const role of notifyRoles) {
      const ur = await fetch(`${SURL}/rest/v1/users?role=eq.${role}&select=id`, { headers: H() });
      const ru = await ur.json();
      if (Array.isArray(ru) && ru.length > 0) {
        await fetch(`${SURL}/rest/v1/notifications`, { method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(ru.map((u:Record<string,string>) => ({ user_id: u.id, type: 'absence', read: false, title: requires_followup ? `⚠ Follow-up needed: ${member_name}` : `Absence: ${member_name}`, body: `${user.name} reports ${member_name} absent. ${requires_followup?`Follow-up required: ${followup_scope||'See details'}`:``}` }))) }).catch(() => {});
      }
    }
    return NextResponse.json({ data: { report }, error: null }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { id, pastor_instruction, pastor_instruction_visibility, followup_status } = await req.json();
    const payload: Record<string,unknown> = { updated_at: new Date().toISOString() };
    if (pastor_instruction !== undefined) {
      if (user.role !== 'overseer') return NextResponse.json({ data: null, error: { message: 'Only pastor can give instructions' } }, { status: 403 });
      payload.pastor_instruction = pastor_instruction;
      payload.pastor_instruction_visibility = pastor_instruction_visibility || ['all'];
      const visibility: string[] = pastor_instruction_visibility?.includes('all') ? ['cell_leader','fellowship_head','care_team','pa'] : (pastor_instruction_visibility || ['all']);
      for (const role of visibility) {
        const ur = await fetch(`${SURL}/rest/v1/users?role=eq.${role}&select=id`, { headers: H() });
        const ru = await ur.json();
        if (Array.isArray(ru) && ru.length > 0) {
          await fetch(`${SURL}/rest/v1/notifications`, { method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(ru.map((u:Record<string,string>) => ({ user_id: u.id, type: 'pastor_instruction', read: false, title: 'Pastor instruction', body: `Pastor: "${pastor_instruction}"` }))) }).catch(() => {});
        }
      }
    }
    if (followup_status) payload.followup_status = followup_status;
    await fetch(`${SURL}/rest/v1/absence_reports?id=eq.${id}`, { method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(payload) });
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
