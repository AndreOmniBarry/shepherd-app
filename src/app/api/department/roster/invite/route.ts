export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

async function ownDepartmentId(userId: string): Promise<string | null> {
  const res = await fetch(`${SURL}/rest/v1/users?id=eq.${userId}&select=department_id&limit=1`, { headers: H() });
  const data = await res.json();
  return data?.[0]?.department_id || null;
}

// Department head invites one of their own roster members onto the
// workforce self-serve portal — narrowly scoped: role is always
// 'workforce', department_id is always the caller's own, and the member
// must already be on that department's roster. Deliberately does not
// touch /api/invites' broader admin auth model.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || user.role !== 'department_head') {
      return NextResponse.json({ data: null, error: { message: 'Only a department head can invite a roster member' } }, { status: 403 });
    }
    const department_id = await ownDepartmentId(user.id);
    if (!department_id) return NextResponse.json({ data: null, error: { message: 'No department assigned to your account' } }, { status: 400 });

    const { member_id, email } = await req.json();
    if (!member_id || !email?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'member_id and email are required' } }, { status: 400 });
    }

    const memberRes = await fetch(`${SURL}/rest/v1/department_members?department_id=eq.${department_id}&member_id=eq.${member_id}&select=members(id,full_name)&limit=1`, { headers: H() });
    // department_members has no church_id of its own, but department_id was
    // already resolved from this caller's own account, so it's implicitly
    // scoped to their church.
    const memberData = await memberRes.json();
    const member = memberData?.[0]?.members as { id: string; full_name: string } | undefined;
    if (!member) return NextResponse.json({ data: null, error: { message: 'That member is not on your department roster' } }, { status: 404 });

    const normalizedEmail = email.toLowerCase().trim();
    const checkRes = await fetch(`${SURL}/rest/v1/invites?email=eq.${encodeURIComponent(normalizedEmail)}&used=eq.false&select=id,expires_at&limit=1`, { headers: H() });
    const existing = await checkRes.json();
    if (existing?.[0] && new Date(existing[0].expires_at) > new Date()) {
      return NextResponse.json({ data: null, error: { message: 'An active invite already exists for that email.' } }, { status: 409 });
    }

    const res = await fetch(`${SURL}/rest/v1/invites`, {
      method: 'POST', headers: { ...H(), Prefer: 'return=representation' },
      body: JSON.stringify({
        email: normalizedEmail,
        full_name: member.full_name,
        role: 'workforce',
        department_id,
        member_id: member.id,
        created_by: user.id,
        church_id: user.church_id,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    });
    const data = await res.json();
    const invite = Array.isArray(data) ? data[0] : data;
    if (!invite?.id) return NextResponse.json({ data: null, error: { message: 'Failed to create invite' } }, { status: 500 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://justshephrd.com';
    return NextResponse.json({ data: { invite_link: `${baseUrl}/register?token=${invite.token}` }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/department/roster/invite]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create invite' } }, { status: 500 });
  }
}
