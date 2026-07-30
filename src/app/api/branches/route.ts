export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !['overseer', 'general_overseer', 'pa', 'lead_tech'].includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }
  const res = await fetch(`${S}/rest/v1/branches?order=is_headquarters.desc,name.asc&select=id,name,is_headquarters`, { headers: H() });
  const data = await res.json();
  return NextResponse.json({ data: { branches: Array.isArray(data) ? data : [] }, error: null });
}
