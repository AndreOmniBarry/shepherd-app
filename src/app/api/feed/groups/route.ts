export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

const LEADERSHIP = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Every group a user can see: the church-wide feed (theirs if branch-
// scoped, or the global one), plus department groups — leadership sees
// every department group for oversight; anyone else only sees a
// department group they're actually a member of, or one they head.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const churchFilter = user.branch_id ? `&or=(branch_id.eq.${user.branch_id},branch_id.is.null)` : '&branch_id=is.null';
  const churchRes = await fetch(`${S}/rest/v1/feed_groups?type=eq.church${churchFilter}&select=id,type,name,department_id,branch_id&limit=1`, { headers: H() });
  const churchGroups = await churchRes.json().catch(() => []);

  let deptGroups: Record<string, unknown>[] = [];
  if (LEADERSHIP.includes(user.role)) {
    const res = await fetch(`${S}/rest/v1/feed_groups?type=eq.department&select=id,type,name,department_id,departments(name)`, { headers: H() });
    deptGroups = await res.json().catch(() => []);
  } else {
    const memberRes = await fetch(`${S}/rest/v1/feed_group_members?user_id=eq.${user.id}&select=group_id`, { headers: H() });
    const memberRows = await memberRes.json().catch(() => []);
    const groupIds = new Set((Array.isArray(memberRows) ? memberRows : []).map((r: { group_id: string }) => r.group_id));
    if (user.role === 'department_head') {
      const deptRes = await fetch(`${S}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: H() });
      const deptData = await deptRes.json().catch(() => []);
      const departmentId = deptData?.[0]?.department_id;
      if (departmentId) {
        const res = await fetch(`${S}/rest/v1/feed_groups?type=eq.department&department_id=eq.${departmentId}&select=id,type,name,department_id,departments(name)`, { headers: H() });
        const rows = await res.json().catch(() => []);
        (Array.isArray(rows) ? rows : []).forEach((r: { id: string }) => groupIds.add(r.id));
      }
    }
    if (groupIds.size > 0) {
      const res = await fetch(`${S}/rest/v1/feed_groups?id=in.(${[...groupIds].join(',')})&select=id,type,name,department_id,departments(name)`, { headers: H() });
      deptGroups = await res.json().catch(() => []);
    }
  }

  return NextResponse.json({ data: { groups: [...(Array.isArray(churchGroups) ? churchGroups : []), ...deptGroups] }, error: null });
}

// Creates the one-and-only feed group for the caller's department — a
// department_head only, and only for their own department. Auto-populates
// membership from department_members (only rows that also have a linked
// login account, since feed_group_members references users not members).
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || user.role !== 'department_head') {
    return NextResponse.json({ data: null, error: { message: 'Only a department head can create their department\'s group' } }, { status: 403 });
  }

  const deptRes = await fetch(`${S}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: H() });
  const deptData = await deptRes.json().catch(() => []);
  const departmentId = deptData?.[0]?.department_id;
  if (!departmentId) return NextResponse.json({ data: null, error: { message: 'No department assigned to your account' } }, { status: 400 });

  const existingRes = await fetch(`${S}/rest/v1/feed_groups?type=eq.department&department_id=eq.${departmentId}&select=id&limit=1`, { headers: H() });
  const existing = await existingRes.json().catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json({ data: null, error: { message: 'This department already has a group' } }, { status: 409 });
  }

  const { name } = await req.json().catch(() => ({ name: null }));
  const insertRes = await fetch(`${S}/rest/v1/feed_groups`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ type: 'department', department_id: departmentId, branch_id: user.branch_id || null, name: name?.trim() || 'Department Group', created_by: user.id }),
  });
  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('[POST /api/feed/groups]', insertRes.status, err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create group' } }, { status: 502 });
  }
  const inserted = await insertRes.json();
  const group = Array.isArray(inserted) ? inserted[0] : inserted;

  const membersRes = await fetch(`${S}/rest/v1/department_members?department_id=eq.${departmentId}&select=member_id`, { headers: H() });
  const memberRows = await membersRes.json().catch(() => []);
  const memberIds = [...new Set((Array.isArray(memberRows) ? memberRows : []).map((m: { member_id: string }) => m.member_id).filter(Boolean))];
  memberIds.push(user.id);
  if (memberIds.length > 0) {
    const userRes = await fetch(`${S}/rest/v1/users?id=in.(${memberIds.join(',')})&select=id`, { headers: H() });
    const validUsers = await userRes.json().catch(() => []);
    const validIds = (Array.isArray(validUsers) ? validUsers : []).map((u: { id: string }) => u.id);
    if (validIds.length > 0) {
      await fetch(`${S}/rest/v1/feed_group_members`, {
        method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(validIds.map(id => ({ group_id: group.id, user_id: id }))),
      });
    }
  }

  return NextResponse.json({ data: { group }, error: null }, { status: 201 });
}
