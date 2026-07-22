export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// Plain fellowship id/name list, used to populate the "Create Cell" dropdown.
// Was previously fetched client-side straight from Supabase with the public
// anon key — moved server-side so it goes through normal login auth instead
// of relying on the fellowships table being openly readable.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/fellowships?select=id,name&order=name.asc`, { headers: hdrs() });
  const data = await res.json();
  return NextResponse.json({ data: { fellowships: Array.isArray(data) ? data : [] }, error: null });
}
