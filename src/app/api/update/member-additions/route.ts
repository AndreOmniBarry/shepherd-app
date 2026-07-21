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

async function notify(userIds: string[], title: string, body: string, type = 'member_request') {
  if (!userIds.length) return;
  const unique = [...new Set(userIds.filter(Boolean))];
  await fetch(`${SURL}/rest/v1/notifications`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(unique.map(id => ({ user_id: id, type, read: false, title, body }))),
  }).catch(() => {});
}

async function logAudit(request_id: string, action: string, actor: ReturnType<typeof payloadToAuthUser>, details: Record<string,unknown>) {
  await fetch(`${SURL}/rest/v1/request_audit_log`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ request_type: 'member_addition', request_id, action, actor_id: actor.id, actor_name: actor.name, actor_role: actor.role, details }),
  }).catch(() => {});
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'mine';

    let url = `${SURL}/rest/v1/member_additions?order=created_at.desc&limit=50&select=id,full_name,phone,email,gender,date_of_birth,join_date,occupation,address,department_interest,source,status,l1_status,l1_comment,l1_approved_at,l2_status,l2_comment,l2_approved_at,pastor_revoked,pastor_revoke_reason,submitted_by,submitted_by_name,submitted_by_role,created_at`;

    if (scope === 'mine') url += `&submitted_by=eq.${user.id}`;
    else if (scope === 'fellowship' && user.fellowship_id) url += `&fellowship_id=eq.${user.fellowship_id}`;
    else if (scope === 'all') {
      if (!['overseer','pa','lead_tech'].includes(user.role)) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
    }

    const res = await fetch(url, { headers: H() });
    const additions = await res.json();
    return NextResponse.json({ data: { additions: Array.isArray(additions) ? additions : [] }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { full_name, phone, email, gender, date_of_birth, join_date, occupation, address, department_interest, source } = body;
    if (!full_name?.trim()) return NextResponse.json({ data: null, error: { message: 'Full name is required' } }, { status: 400 });

    // Insert the request
    const res = await fetch(`${SURL}/rest/v1/member_additions`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        full_name: full_name.trim(), phone: phone||null, email: email||null,
        gender: gender||null, date_of_birth: date_of_birth||null, join_date: join_date||null,
        occupation: occupation||null, address: address||null,
        department_interest: department_interest||null,
        source: source || (user.role === 'cell_leader' ? 'cell' : user.role === 'department_head' ? 'department' : 'fellowship'),
        fellowship_id: user.fellowship_id || null,
        submitted_by: user.id, submitted_by_name: user.name, submitted_by_role: user.role,
        status: 'pending', l1_status: 'pending', l2_status: 'pending',
      }),
    });
    const data = await res.json();
    const addition = Array.isArray(data) ? data[0] : data;

    // Determine L1 approver based on role and structure
    // Cell leader → L1 is fellowship head, L2 is PA
    // Dept head → L1 is PA (no HOD) or HOD if configured
    // Fellowship head → L1 is PA
    const l1Roles = user.role === 'cell_leader' ? ['fellowship_head'] : ['pa', 'overseer'];
    const l2Roles = ['pa', 'overseer'];

    // Get L1 approvers
    const l1Res = await fetch(`${SURL}/rest/v1/users?${l1Roles.map(r=>`role=eq.${r}`).join('&')}&select=id,full_name`, { headers: H() });
    const l1Users = await l1Res.json();

    // Notify L1
    if (Array.isArray(l1Users) && l1Users.length > 0) {
      await notify(
        l1Users.map((u:Record<string,string>) => u.id),
        'New member addition request',
        `${user.name} has submitted ${full_name} for addition. Please review and approve.`
      );
    }

    // Log audit
    await logAudit(addition.id, 'submitted', user, { full_name, source });

    return NextResponse.json({ data: { addition }, error: null }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ data: null, error: { message: 'Failed to submit' } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { id, action, comment, pastor_revoke_reason } = await req.json();
    if (!id) return NextResponse.json({ data: null, error: { message: 'id required' } }, { status: 400 });

    // Get the current addition
    const curRes = await fetch(`${SURL}/rest/v1/member_additions?id=eq.${id}&limit=1&select=*`, { headers: H() });
    const curData = await curRes.json();
    const cur = curData?.[0];
    if (!cur) return NextResponse.json({ data: null, error: { message: 'Not found' } }, { status: 404 });

    const now = new Date().toISOString();

    if (action === 'l1_approve') {
      // L1 approves → notify L2 (PA)
      await fetch(`${SURL}/rest/v1/member_additions?id=eq.${id}`, {
        method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ l1_status: 'approved', l1_approver_id: user.id, l1_approved_at: now, l1_comment: comment||null, updated_at: now }),
      });
      // Notify PA/overseer for L2
      const paRes = await fetch(`${SURL}/rest/v1/users?role=in.(pa,overseer)&select=id`, { headers: H() });
      const paUsers = await paRes.json();
      await notify(
        (Array.isArray(paUsers)?paUsers:[]).map((u:Record<string,string>)=>u.id),
        'Member request awaiting final approval',
        `${user.name} has approved ${cur.full_name}. Your final approval is needed.`
      );
      await logAudit(id, 'l1_approved', user, { comment });

    } else if (action === 'l1_reject') {
      await fetch(`${SURL}/rest/v1/member_additions?id=eq.${id}`, {
        method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ l1_status: 'rejected', l1_approver_id: user.id, l1_approved_at: now, l1_comment: comment||null, status: 'rejected', updated_at: now }),
      });
      // Notify submitter
      await notify([cur.submitted_by], 'Member request declined', `Your request to add ${cur.full_name} was declined by ${user.name}. Reason: ${comment||'No reason given'}`);
      await logAudit(id, 'l1_rejected', user, { comment });

    } else if (action === 'l2_approve') {
      // Final approval — create the actual member record
      const memberRes = await fetch(`${SURL}/rest/v1/members`, {
        method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          full_name: cur.full_name, phone: cur.phone, email: cur.email,
          gender: cur.gender, date_of_birth: cur.date_of_birth, join_date: cur.join_date||now.split('T')[0],
          occupation: cur.occupation, address: cur.address,
          fellowship_id: cur.fellowship_id, membership_status: 'active',
        }),
      });
      const memberData = await memberRes.json();
      const member = Array.isArray(memberData) ? memberData[0] : memberData;

      await fetch(`${SURL}/rest/v1/member_additions?id=eq.${id}`, {
        method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ l2_status: 'approved', l2_approver_id: user.id, l2_approved_at: now, l2_comment: comment||null, status: 'approved', member_id: member?.id||null, updated_at: now }),
      });
      // Notify submitter + L1 approver
      await notify(
        [cur.submitted_by, cur.l1_approver_id].filter(Boolean),
        '✓ Member added successfully',
        `${cur.full_name} has been added to the church roster by ${user.name}.`
      );
      await logAudit(id, 'l2_approved_member_created', user, { comment, member_id: member?.id });

    } else if (action === 'l2_reject') {
      await fetch(`${SURL}/rest/v1/member_additions?id=eq.${id}`, {
        method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ l2_status: 'rejected', l2_approver_id: user.id, l2_approved_at: now, l2_comment: comment||null, status: 'rejected', updated_at: now }),
      });
      await notify([cur.submitted_by, cur.l1_approver_id].filter(Boolean), 'Member request rejected', `${cur.full_name} was rejected by ${user.name}. Reason: ${comment||'No reason given'}`);
      await logAudit(id, 'l2_rejected', user, { comment });

    } else if (action === 'pastor_revoke') {
      if (!['overseer'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Only pastor can revoke' } }, { status: 403 });
      await fetch(`${SURL}/rest/v1/member_additions?id=eq.${id}`, {
        method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ pastor_revoked: true, pastor_revoke_reason: pastor_revoke_reason||'Revoked by pastor', pastor_revoked_at: now, status: 'revoked', updated_at: now }),
      });
      // Notify all parties
      const notifyIds = [cur.submitted_by, cur.l1_approver_id, cur.l2_approver_id].filter(Boolean);
      await notify(notifyIds, 'Member request revoked by Pastor', `${cur.full_name}'s addition has been revoked by the Pastor. Reason: ${pastor_revoke_reason||'Not specified'}`);
      await logAudit(id, 'pastor_revoked', user, { reason: pastor_revoke_reason });
    }

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
