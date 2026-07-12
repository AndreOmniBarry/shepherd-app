import { NextResponse } from 'next/server';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

export async function GET() {
  const res = await fetch(`${S}/rest/v1/expense_categories?is_active=eq.true&order=name.asc&select=id,name`, { headers: h() });
  const data = await res.json();
  return NextResponse.json({ data: { categories: Array.isArray(data) ? data : [] }, error: null });
}

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${S}/rest/v1/expense_categories`, {
    method: 'POST',
    headers: { ...h(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ name: body.name }),
  });
  const data = await res.json();
  return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
}
