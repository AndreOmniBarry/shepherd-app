import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const p = await verifyToken(token);
  if (!p) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const user = payloadToAuthUser(p);
  if (!['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
  }

  // Verify the requisition belongs to this caller's own church before
  // touching it — without this, any authorized role could approve/pay a
  // requisition belonging to a completely different church by guessing/
  // enumerating its id (IDOR). A branch_pastor is further restricted to
  // their own branch's requisitions. PA is church-wide (not branch-locked)
  // by founder decision — matches the other routes that treat PA this way.
  const ownRes = await fetch(`${S}/rest/v1/expense_requisitions?id=eq.${params.id}&select=branch_id,church_id`, { headers: h() });
  const ownRows = await ownRes.json();
  const reqRow = Array.isArray(ownRows) ? ownRows[0] : null;
  if (!reqRow || reqRow.church_id !== user.church_id) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }
  if (user.role === 'branch_pastor' && reqRow.branch_id !== user.branch_id) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body;
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'approved') { update.approved_by = user.id; update.approved_at = new Date().toISOString(); }
  if (status === 'paid') { update.paid_at = new Date().toISOString(); }

  await fetch(`${S}/rest/v1/expense_requisitions?id=eq.${params.id}&church_id=eq.${user.church_id}`, {
    method: 'PATCH',
    headers: { ...h(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(update),
  });
  // Notify accounts admin when pastor approves/rejects
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://shepherd-app-beta.vercel.app'}/api/notify/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_SECRET || '' },
    body: JSON.stringify({
      event: status === 'paid' ? 'requisition_approved' : 'requisition_raised',
      actor_name: user.id,
      actor_role: user.role,
      church_id: user.church_id,
      detail: `Requisition ${status} by ${user.role}`,
    }),
  }).catch(() => {});
  return NextResponse.json({ data: { updated: true }, error: null });
}
