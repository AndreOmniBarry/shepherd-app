export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// Cell leaders can't reassign members themselves (no direct authority over
// cell membership) — this just raises a flag with their fellowship head, who
// has the actual tool (PATCH /api/fellowship/members) to fix the placement.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'cell_leader') {
      return NextResponse.json({ data: null, error: { message: 'Only a cell leader can flag a placement issue' } }, { status: 403 });
    }

    const { member_id, note } = await req.json();
    if (!member_id || !note?.trim()) return NextResponse.json({ data: null, error: { message: 'member_id and a note are required' } }, { status: 400 });

    const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}&select=id,full_name,fellowship_id&limit=1`, { headers: hdrs() });
    const member = (await memberRes.json())?.[0];
    if (!member) return NextResponse.json({ data: null, error: { message: 'Member not found' } }, { status: 404 });

    const recipients: string[] = [];
    if (member.fellowship_id) {
      const fhRes = await fetch(`${SUPABASE_URL}/rest/v1/users?fellowship_id=eq.${member.fellowship_id}&role=eq.fellowship_head&select=id`, { headers: hdrs() });
      const fhData = await fhRes.json();
      if (Array.isArray(fhData)) recipients.push(...fhData.map((u: { id: string }) => u.id));
    }
    const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa,lead_tech)&select=id`, { headers: hdrs() });
    const adminData = await adminRes.json();
    if (Array.isArray(adminData)) recipients.push(...adminData.map((u: { id: string }) => u.id));

    const uniqueRecipients = [...new Set(recipients)];
    if (uniqueRecipients.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify(uniqueRecipients.map(uid => ({
          user_id: uid, type: 'pipeline', read: false,
          title: 'Member placement flagged for review',
          body: `${user.name || 'A cell leader'} flagged ${member.full_name}: "${note.trim()}"`,
          link: '/fellowship',
        }))),
      }).catch(() => {});
    }

    return NextResponse.json({ data: { flagged: true }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/cell/flag-correction]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to flag correction' } }, { status: 500 });
  }
}
