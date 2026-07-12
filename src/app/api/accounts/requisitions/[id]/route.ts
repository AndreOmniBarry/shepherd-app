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

  const body = await req.json();
  const { status } = body;
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'approved') { update.approved_by = user.id; update.approved_at = new Date().toISOString(); }
  if (status === 'paid') { update.paid_at = new Date().toISOString(); }

  await fetch(`${S}/rest/v1/expense_requisitions?id=eq.${params.id}`, {
    method: 'PATCH',
    headers: { ...h(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(update),
  });
  return NextResponse.json({ data: { updated: true }, error: null });
}
