import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

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
  const res = await fetch(`${S}/rest/v1/expense_categories?is_active=eq.true&order=name.asc&select=id,name&church_id=eq.${user.church_id}`, { headers: h() });
  const data = await res.json();
  return NextResponse.json({ data: { categories: Array.isArray(data) ? data : [] }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const body = await req.json();
  const res = await fetch(`${S}/rest/v1/expense_categories`, {
    method: 'POST',
    headers: { ...h(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ name: body.name, church_id: user.church_id || null }),
  });
  const data = await res.json();
  return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
}
