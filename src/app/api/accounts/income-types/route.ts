import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireFinanceAccess } from '@/lib/pa-governance';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

const ALLOWED = ['overseer', 'pa', 'lead_tech', 'accounts'];

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const financeBlocked = requireFinanceAccess(user);
  if (financeBlocked) return financeBlocked;
  const res = await fetch(`${S}/rest/v1/income_types?order=name.asc&select=id,name,category&church_id=eq.${user.church_id}`, { headers: h() });
  const data = await res.json();
  return NextResponse.json({ data: { types: Array.isArray(data) ? data : [] }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const financeBlocked = requireFinanceAccess(user);
  if (financeBlocked) return financeBlocked;
  const body = await req.json();
  const res = await fetch(`${S}/rest/v1/income_types`, {
    method: 'POST',
    headers: { ...h(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ name: body.name, category: body.category || 'general', church_id: user.church_id || null }),
  });
  const data = await res.json();
  return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
}
