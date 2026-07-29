export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const p = await verifyToken(token);
  return p ? payloadToAuthUser(p) : null;
}

const ALLOWED = ['overseer', 'pa', 'lead_tech', 'accounts'];

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const res = await fetch(`${S}/rest/v1/financial_periods?order=period_month.desc&limit=24&select=id,period_month,closed_at,note`, { headers: h() });
  const data = await res.json();
  return NextResponse.json({ data: { periods: Array.isArray(data) ? data : [] }, error: null });
}

// Close a month — from this point on, /api/accounts/income rejects any new
// non-adjustment entry dated within it.
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const { period_month, note } = await req.json();
  if (!period_month) return NextResponse.json({ data: null, error: { message: 'period_month is required' } }, { status: 400 });
  const monthStart = period_month.slice(0, 7) + '-01';
  const res = await fetch(`${S}/rest/v1/financial_periods`, {
    method: 'POST', headers: { ...h(), Prefer: 'return=representation' },
    body: JSON.stringify({ period_month: monthStart, closed_by: user.id, note: note || null }),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = (Array.isArray(data) ? data[0] : data)?.message;
    return NextResponse.json({ data: null, error: { message: detail?.includes('duplicate') ? 'That month is already closed.' : (detail || 'Failed to close period') } }, { status: 409 });
  }
  return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
}

// Reopen a closed month — deliberately restricted to overseer/lead_tech only,
// since reopening is the one action that could let a "final" figure move.
export async function DELETE(req: Request) {
  const user = await getUser(req);
  if (!user || !['overseer', 'lead_tech'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Only the overseer or lead tech can reopen a closed period' } }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ data: null, error: { message: 'id is required' } }, { status: 400 });
  await fetch(`${S}/rest/v1/financial_periods?id=eq.${id}`, { method: 'DELETE', headers: h() });
  return NextResponse.json({ data: { reopened: true }, error: null });
}
