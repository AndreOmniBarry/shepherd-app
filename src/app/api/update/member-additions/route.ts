import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { sendSMS, welcomeMessage } from '@/lib/sms';
import { computeSlaGrade } from '@/lib/sla';

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

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const cell_id = user.cell_id;
    const body = await req.json();
    const { full_name, phone, email, date_of_birth, gender, join_date, occupation, address, department_interest } = body;

    if (!full_name) return NextResponse.json({ data: null, error: { message: 'Full name is required' } }, { status: 400 });

    const fellowship_id = user.fellowship_id || await (async () => { const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs() }); const d = await r.json(); return d?.[0]?.fellowship_id || null; })();
    const dept_res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: hdrs() });
    const dept_data = await dept_res.json();
    const department_id = dept_data?.[0]?.department_id || null;

    const source = user.role === 'department_head' ? 'department' : user.role === 'fellowship_head' ? 'fellowship' : cell_id ? 'cell' : 'direct';

    const res = await fetch(`${SUPABASE_URL}/rest/v1/member_additions`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        full_name: full_name.trim(),
        phone: phone || null,
        email: email || null,
        date_of_birth: date_of_birth || null,
        gender: gender || null,
        occupation: occupation || null,
        address: address || null,
        department_interest: department_interest || null,
        cell_id: cell_id || null,
        fellowship_id,
        department_id,
        join_date: join_date || new Date().toISOString().split('T')[0],
        submitted_by: user.id,
        submitted_by_name: user.name || null,
        submitted_by_role: user.role,
        source,
        status: 'pending',
        l1_status: 'pending',
        l2_status: 'pending',
      }),
    });
    const data = await res.json();

    // Notify fellowship head / department head (L1) and overseers/PA (can always approve directly)
    const l1Res = fellowship_id
      ? await fetch(`${SUPABASE_URL}/rest/v1/users?fellowship_id=eq.${fellowship_id}&role=eq.fellowship_head&select=id`, { headers: hdrs() })
      : department_id
        ? await fetch(`${SUPABASE_URL}/rest/v1/users?department_id=eq.${department_id}&role=eq.department_head&select=id`, { headers: hdrs() })
        : null;
    const l1Data = l1Res ? await l1Res.json() : [];
    const adminRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa,lead_tech)&select=id`, { headers: hdrs() });
    const adminData = await adminRes.json();
    const notifyIds = [...(Array.isArray(l1Data) ? l1Data.map((u: Record<string,string>) => u.id) : []), ...(Array.isArray(adminData) ? adminData.map((u: Record<string,string>) => u.id) : [])].filter((v, i, a) => a.indexOf(v) === i);
    if (notifyIds.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(notifyIds.map(uid => ({
          user_id: uid,
          type: 'pipeline',
          title: 'New member addition request',
          body: `${full_name} submitted by ${user.name || user.role} — pending approval`,
          link: '/dashboard',
          read: false,
        }))),
      });
    }

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/update/member-additions]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to submit' } }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope'); // 'review' = things I can approve; default = my own submissions

    const select = 'id,full_name,phone,email,gender,date_of_birth,join_date,occupation,address,status,l1_status,l2_status,l1_approved_at,l2_approved_at,pastor_revoked,pastor_revoke_reason,submitted_by_name,submitted_by_role,source,created_member_id,created_at';

    if (scope === 'review') {
      let url = `${SUPABASE_URL}/rest/v1/member_additions?order=created_at.desc&limit=200&select=${select}`;
      if (ADMIN_ROLES.includes(user.role)) {
        // Pastor/admin see everything — pending across the board plus anything they can revoke
      } else if (user.role === 'fellowship_head') {
        const fellowship_id = user.fellowship_id || await (async () => { const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs() }); const d = await r.json(); return d?.[0]?.fellowship_id || null; })();
        if (!fellowship_id) return NextResponse.json({ data: { additions: [] }, error: null });
        url += `&fellowship_id=eq.${fellowship_id}`;
      } else if (user.role === 'department_head') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: hdrs() });
        const d = await r.json();
        const department_id = d?.[0]?.department_id;
        if (!department_id) return NextResponse.json({ data: { additions: [] }, error: null });
        url += `&department_id=eq.${department_id}`;
      } else {
        return NextResponse.json({ data: null, error: { message: 'Not authorized to review submissions' } }, { status: 403 });
      }
      const res = await fetch(url, { headers: hdrs() });
      const data = await res.json();
      // SLA measures how quickly the L1 reviewer (fellowship/dept head) or L2
      // (admin) actually acted, not the pastor/tech/PA's own workload.
      const additions = (Array.isArray(data) ? data : []).map((a: Record<string, unknown>) => {
        const approvedAt = ADMIN_ROLES.includes(user.role) ? a.l2_approved_at : a.l1_approved_at;
        return { ...a, sla_grade: approvedAt && a.created_at ? computeSlaGrade(a.created_at as string, approvedAt as string) : null };
      });
      return NextResponse.json({ data: { additions }, error: null });
    }

    // Default: "my submissions" — cell leaders/dept heads/fellowship heads see what they personally submitted
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/member_additions?submitted_by=eq.${user.id}&order=created_at.desc&limit=100&select=${select}`,
      { headers: hdrs() }
    );
    const data = await res.json();
    return NextResponse.json({ data: { additions: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    console.error('[GET /api/update/member-additions]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load' } }, { status: 500 });
  }
}

// PATCH — approve / reject / revoke. This is where a pending submission
// actually becomes a live members row (or where a live one gets pulled back).
export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { id, action, comment } = body as { id: string; action: 'approve' | 'reject' | 'revoke'; comment?: string };
    if (!id || !action) return NextResponse.json({ data: null, error: { message: 'id and action are required' } }, { status: 400 });

    const recRes = await fetch(`${SUPABASE_URL}/rest/v1/member_additions?id=eq.${id}&limit=1`, { headers: hdrs() });
    const recData = await recRes.json();
    const record = recData?.[0];
    if (!record) return NextResponse.json({ data: null, error: { message: 'Submission not found' } }, { status: 404 });

    const isAdmin = ADMIN_ROLES.includes(user.role);
    const isL1ForThis =
      (user.role === 'fellowship_head' && user.fellowship_id && user.fellowship_id === record.fellowship_id) ||
      (user.role === 'department_head' && record.department_id && await (async () => {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: hdrs() });
        const d = await r.json();
        return d?.[0]?.department_id === record.department_id;
      })());

    if (action === 'revoke') {
      // Pastor/admin only — pulls a live member back out of circulation, comment required.
      if (!isAdmin) return NextResponse.json({ data: null, error: { message: 'Only the pastor or church admin can revoke' } }, { status: 403 });
      if (!comment?.trim()) return NextResponse.json({ data: null, error: { message: 'A comment is required to revoke' } }, { status: 400 });

      if (record.created_member_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${record.created_member_id}`, {
          method: 'PATCH', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
          body: JSON.stringify({ membership_status: 'inactive' }),
        });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/member_additions?id=eq.${id}`, {
        method: 'PATCH', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ pastor_revoked: true, pastor_revoke_reason: comment.trim(), pastor_revoked_at: new Date().toISOString(), status: 'revoked' }),
      });
      return NextResponse.json({ data: { revoked: true }, error: null });
    }

    if (!isAdmin && !isL1ForThis) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized to act on this submission' } }, { status: 403 });
    }

    if (action === 'reject') {
      const level = isAdmin ? 'l2_status' : 'l1_status';
      const commentField = isAdmin ? 'l2_comment' : 'l1_comment';
      await fetch(`${SUPABASE_URL}/rest/v1/member_additions?id=eq.${id}`, {
        method: 'PATCH', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'rejected', [level]: 'rejected', [commentField]: comment || null }),
      });
      return NextResponse.json({ data: { rejected: true }, error: null });
    }

    if (action === 'approve') {
      // Fellowship/department head approval (L1) OR direct pastor/admin approval (treated as
      // both levels at once) — either path makes the member live immediately. This matches a
      // single-gate model: one qualified approver (leader or admin) is enough to go live,
      // with the pastor able to revoke afterwards if something was wrong.
      const approverField = isAdmin ? 'l2_approver_id' : 'l1_approver_id';
      const approvedAtField = isAdmin ? 'l2_approved_at' : 'l1_approved_at';
      const statusField = isAdmin ? 'l2_status' : 'l1_status';
      const commentField = isAdmin ? 'l2_comment' : 'l1_comment';

      const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          full_name: record.full_name,
          phone: record.phone || null,
          email: record.email || null,
          gender: record.gender || null,
          date_of_birth: record.date_of_birth || null,
          occupation: record.occupation || null,
          address: record.address || null,
          cell_id: record.cell_id || null,
          fellowship_id: record.fellowship_id || null,
          membership_status: 'active',
          join_date: record.join_date || new Date().toISOString().split('T')[0],
        }),
      });
      const memberData = await memberRes.json();
      const member = Array.isArray(memberData) ? memberData[0] : memberData;
      if (!memberRes.ok || !member?.id) {
        console.error('[PATCH member-additions] failed to create member:', memberData);
        return NextResponse.json({ data: null, error: { message: 'Failed to create member record' } }, { status: 500 });
      }

      if (record.department_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/department_members`, {
          method: 'POST', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
          body: JSON.stringify({ department_id: record.department_id, member_id: member.id, role: 'member' }),
        });
      }

      await fetch(`${SUPABASE_URL}/rest/v1/member_additions?id=eq.${id}`, {
        method: 'PATCH', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          status: 'approved', [statusField]: 'approved', [approverField]: user.id,
          [approvedAtField]: new Date().toISOString(), [commentField]: comment || null,
          created_member_id: member.id,
        }),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify([{
          user_id: record.submitted_by, type: 'pipeline', read: false,
          title: 'Member addition approved',
          body: `${record.full_name} is now a live member.`,
        }]),
      }).catch(() => {});

      if (member.phone) sendSMS(member.phone, welcomeMessage(member.full_name)).catch(() => {});

      return NextResponse.json({ data: { approved: true, member_id: member.id }, error: null });
    }

    return NextResponse.json({ data: null, error: { message: 'Unknown action' } }, { status: 400 });
  } catch (err) {
    console.error('[PATCH /api/update/member-additions]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update submission' } }, { status: 500 });
  }
}
