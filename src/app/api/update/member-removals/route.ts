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

const ADMIN_ROLES = ['overseer', 'pa', 'lead_tech'];
const RECOMMEND_ROLES = ['fellowship_head', 'department_head'];

// Recommend a member's removal — fellowship/department heads only. Cell
// leaders have no route in here at all; they raise it with their fellowship
// head directly, matching the church's actual chain of command.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !RECOMMEND_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Only a fellowship head or department head can recommend a removal' } }, { status: 403 });
    }

    const { member_id, reason } = await req.json();
    if (!member_id || !reason?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'A member and a reason are required' } }, { status: 400 });
    }

    const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}&select=id,full_name&limit=1`, { headers: hdrs() });
    const memberData = await memberRes.json();
    const member = memberData?.[0];
    if (!member) return NextResponse.json({ data: null, error: { message: 'Member not found' } }, { status: 404 });

    const row = {
      member_id,
      member_name: member.full_name,
      reason: reason.trim(),
      recommended_by: user.id,
      recommended_by_name: user.name || null,
      recommended_by_role: user.role,
      fellowship_id: user.role === 'fellowship_head' ? user.fellowship_id : null,
      department_id: null as string | null,
      status: 'pending',
    };
    if (user.role === 'department_head') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: hdrs() });
      const d = await r.json();
      row.department_id = d?.[0]?.department_id || null;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/member_removals`, {
      method: 'POST', headers: { ...hdrs(), Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    const data = await res.json();

    const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa,lead_tech)&select=id`, { headers: hdrs() });
    const adminData = await adminRes.json();
    if (Array.isArray(adminData) && adminData.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify(adminData.map((u: { id: string }) => ({
          user_id: u.id, type: 'pipeline', read: false,
          title: 'Member removal recommended',
          body: `${member.full_name} recommended for removal by ${user.name || user.role} — pending approval`,
          link: '/dashboard',
        }))),
      }).catch(() => {});
    }

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/update/member-removals]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to submit removal recommendation' } }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const select = 'id,member_id,member_name,reason,recommended_by_name,recommended_by_role,status,approved_at,approval_comment,pastor_revoked,pastor_revoke_reason,created_at';

    if (ADMIN_ROLES.includes(user.role)) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/member_removals?order=created_at.desc&limit=200&select=${select}`, { headers: hdrs() });
      const data = await res.json();
      return NextResponse.json({ data: { removals: Array.isArray(data) ? data : [] }, error: null });
    }

    if (RECOMMEND_ROLES.includes(user.role)) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/member_removals?recommended_by=eq.${user.id}&order=created_at.desc&limit=100&select=${select}`, { headers: hdrs() });
      const data = await res.json();
      return NextResponse.json({ data: { removals: Array.isArray(data) ? data : [] }, error: null });
    }

    return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
  } catch (err) {
    console.error('[GET /api/update/member-removals]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load' } }, { status: 500 });
  }
}

// PATCH — approve (marks the member inactive), reject, or revoke (pastor-only,
// restores an already-approved removal).
export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { id, action, comment } = await req.json() as { id: string; action: 'approve' | 'reject' | 'revoke'; comment?: string };
    if (!id || !action) return NextResponse.json({ data: null, error: { message: 'id and action are required' } }, { status: 400 });

    const recRes = await fetch(`${SUPABASE_URL}/rest/v1/member_removals?id=eq.${id}&limit=1`, { headers: hdrs() });
    const recData = await recRes.json();
    const record = recData?.[0];
    if (!record) return NextResponse.json({ data: null, error: { message: 'Recommendation not found' } }, { status: 404 });

    if (action === 'revoke') {
      if (user.role !== 'overseer') {
        return NextResponse.json({ data: null, error: { message: 'Only the overseer can revoke a removal' } }, { status: 403 });
      }
      if (!comment?.trim()) return NextResponse.json({ data: null, error: { message: 'A comment is required to revoke' } }, { status: 400 });
      if (record.status !== 'approved') return NextResponse.json({ data: null, error: { message: 'Only an approved removal can be revoked' } }, { status: 400 });

      if (record.member_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${record.member_id}`, {
          method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
          body: JSON.stringify({ membership_status: 'active' }),
        });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/member_removals?id=eq.${id}`, {
        method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify({ pastor_revoked: true, pastor_revoke_reason: comment.trim(), pastor_revoked_at: new Date().toISOString() }),
      });
      return NextResponse.json({ data: { revoked: true }, error: null });
    }

    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Only the pastor or church admin can authorise a removal' } }, { status: 403 });
    }
    if (record.status !== 'pending') {
      return NextResponse.json({ data: null, error: { message: 'This recommendation has already been decided' } }, { status: 400 });
    }

    if (action === 'reject') {
      await fetch(`${SUPABASE_URL}/rest/v1/member_removals?id=eq.${id}`, {
        method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'rejected', approved_by: user.id, approved_at: new Date().toISOString(), approval_comment: comment || null }),
      });
      return NextResponse.json({ data: { rejected: true }, error: null });
    }

    if (action === 'approve') {
      if (record.member_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${record.member_id}`, {
          method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
          body: JSON.stringify({ membership_status: 'inactive' }),
        });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/member_removals?id=eq.${id}`, {
        method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString(), approval_comment: comment || null }),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify([{
          user_id: record.recommended_by, type: 'pipeline', read: false,
          title: 'Removal approved',
          body: `${record.member_name}'s removal was authorised.`,
        }]),
      }).catch(() => {});

      return NextResponse.json({ data: { approved: true }, error: null });
    }

    return NextResponse.json({ data: null, error: { message: 'Unknown action' } }, { status: 400 });
  } catch (err) {
    console.error('[PATCH /api/update/member-removals]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update recommendation' } }, { status: 500 });
  }
}
