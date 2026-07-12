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

export async function GET() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const res = await fetch(
    `${S}/rest/v1/income_records?service_date=gte.${cutoff.toISOString().split('T')[0]}&order=service_date.desc&limit=200&select=id,amount,member_name,service_date,notes,income_types(name)`,
    { headers: h() }
  );
  const data = await res.json();
  const records = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    ...r,
    income_type_name: (r.income_types as Record<string, string> | null)?.name || '',
  }));
  return NextResponse.json({ data: { records }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const body = await req.json();
  const { income_type_id, member_name, amount, service_date, notes, fellowship_id } = body;
  const res = await fetch(`${S}/rest/v1/income_records`, {
    method: 'POST',
    headers: { ...h(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      income_type_id,
      member_name: member_name || null,
      amount: parseFloat(amount),
      service_date,
      notes: notes || null,
      fellowship_id: fellowship_id || null,
      submitted_by: user.id,
    }),
  });
  const data = await res.json();
  return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
}
