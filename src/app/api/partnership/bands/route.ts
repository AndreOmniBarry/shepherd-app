import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}` });

const ALLOWED = ['overseer', 'pa', 'lead_tech', 'partnership'];

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const p = await verifyToken(token);
  const user = p ? payloadToAuthUser(p) : null;
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const res = await fetch(`${S}/rest/v1/partnership_bands?order=sort_order.asc&select=id,name,amount,color`, { headers: h() });
  const data = await res.json();
  return NextResponse.json({ data: { bands: Array.isArray(data) ? data : [] }, error: null });
}
