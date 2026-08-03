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

// Admin equivalent of /api/department/members — that one only ever lets a
// department head manage their own roster (department_id resolved from
// their own account, never trusted from the client). This one takes an
// explicit department_id, for adding/removing a member to/from ANY
// department, since lead_tech/pa/overseer aren't scoped to just one.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const { department_id, member_id, role } = await req.json();
    if (!department_id || !member_id) return NextResponse.json({ data: null, error: { message: 'department_id and member_id are required' } }, { status: 400 });

    // department_members has no church_id of its own — verify both the
    // department and the member actually belong to this admin's own
    // church before linking them, otherwise a guessed/leaked id from
    // another church could be silently added to a roster.
    const [deptCheck, memberCheck] = await Promise.all([
      fetch(`${SURL}/rest/v1/departments?id=eq.${department_id}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() }).then(r => r.json()),
      fetch(`${SURL}/rest/v1/members?id=eq.${member_id}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() }).then(r => r.json()),
    ]);
    if (!deptCheck?.[0] || !memberCheck?.[0]) {
      return NextResponse.json({ data: null, error: { message: 'Department or member not found' } }, { status: 404 });
    }

    const res = await fetch(`${SURL}/rest/v1/department_members`, {
      method: 'POST', headers: { ...H(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ department_id, member_id, role: role?.trim() || 'member' }),
    });
    if (!res.ok) return NextResponse.json({ data: null, error: { message: 'Failed to add member' } }, { status: 500 });
    return NextResponse.json({ data: { added: true }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/departments/members]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to add member' } }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const department_id = searchParams.get('department_id');
    const member_id = searchParams.get('member_id');
    if (!department_id || !member_id) return NextResponse.json({ data: null, error: { message: 'department_id and member_id are required' } }, { status: 400 });

    // Same church guard as POST — verify the department belongs to this
    // admin's own church before removing anyone from its roster.
    const deptCheck = await fetch(`${SURL}/rest/v1/departments?id=eq.${department_id}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() }).then(r => r.json());
    if (!deptCheck?.[0]) return NextResponse.json({ data: null, error: { message: 'Department not found' } }, { status: 404 });

    await fetch(`${SURL}/rest/v1/department_members?department_id=eq.${department_id}&member_id=eq.${member_id}`, {
      method: 'DELETE', headers: H(),
    });
    return NextResponse.json({ data: { removed: true }, error: null });
  } catch (err) {
    console.error('[DELETE /api/admin/departments/members]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to remove member' } }, { status: 500 });
  }
}
