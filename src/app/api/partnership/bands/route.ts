import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { requirePremium } from '@/lib/plan-gate';
import { requireFinanceAccess } from '@/lib/pa-governance';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}` });

const ALLOWED = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech', 'partnership'];

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const p = await verifyToken(token);
  const user = p ? payloadToAuthUser(p) : null;
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const financeBlocked = requireFinanceAccess(user);
  if (financeBlocked) return financeBlocked;
  const blocked = await requirePremium(user.church_id, user.id);
  if (blocked) return blocked;

  const res = await fetch(`${S}/rest/v1/partnership_bands?order=sort_order.asc&select=id,name,amount,color&church_id=eq.${user.church_id}`, { headers: h() });
  const data = await res.json();
  return NextResponse.json({ data: { bands: Array.isArray(data) ? data : [] }, error: null });
}

// Fills the gap noted above the old GET comment: existing bands were all
// seeded directly in the DB against the one original production church, so
// any newly onboarded church landed here with an empty list and no way to
// ever add a partner — the "Select band" dropdown had nothing in it and
// nothing in the product could put something there. Mirrors
// /api/fellowships/create's inline-creation pattern.
export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const p = await verifyToken(token);
  const user = p ? payloadToAuthUser(p) : null;
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const financeBlocked = requireFinanceAccess(user);
  if (financeBlocked) return financeBlocked;
  const blocked = await requirePremium(user.church_id, user.id);
  if (blocked) return blocked;

  const body = await req.json();
  const name = (body.name || '').trim();
  const amount = parseFloat(body.amount);
  if (!name || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ data: null, error: { message: 'A band name and a monthly amount greater than 0 are required' } }, { status: 400 });
  }

  // New bands sort after whatever this church already has, so an admin
  // building up a Silver/Gold/Platinum ladder gets them back in the order
  // they were created instead of an arbitrary one.
  const countRes = await fetch(`${S}/rest/v1/partnership_bands?church_id=eq.${user.church_id}&select=id`, { headers: h() });
  const countData = await countRes.json();
  const sortOrder = Array.isArray(countData) ? countData.length : 0;

  const res = await fetch(`${S}/rest/v1/partnership_bands`, {
    method: 'POST',
    headers: { ...h(), 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ name, amount, color: body.color || '#534AB7', sort_order: sortOrder, church_id: user.church_id }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error('partnership_bands insert failed:', errBody);
    return NextResponse.json({ data: null, error: { message: 'Failed to create band' } }, { status: 500 });
  }
  const data = await res.json();
  return NextResponse.json({ data: { band: Array.isArray(data) ? data[0] : data }, error: null }, { status: 201 });
}
