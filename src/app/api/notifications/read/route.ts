import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export async function POST(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);

    await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${user.id}&read=eq.false`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ read: true }),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to mark read' } }, { status: 500 });
  }
}
