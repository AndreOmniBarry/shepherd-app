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

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&order=created_at.desc&limit=30&select=id,type,title,body,read,created_at,link`,
      { headers: hdrs() }
    );
    const data = await res.json();
    return NextResponse.json({ data: { notifications: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load notifications' } }, { status: 500 });
  }
}
