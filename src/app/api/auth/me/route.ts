import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/shepherd_token=([^;]+)/);
    const token = match?.[1];

    if (!token) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ data: null, error: { message: 'Invalid token' } }, { status: 401 });
    }

    const user = payloadToAuthUser(payload);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Fetch full profile to get real full_name
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=id,email,full_name,role,cell_id&limit=1`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );
    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;

    let cellName = null;
    if (profile?.cell_id) {
      const cellRes = await fetch(
        `${SUPABASE_URL}/rest/v1/cells?id=eq.${profile.cell_id}&select=name&limit=1`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      );
      const cells = await cellRes.json();
      cellName = cells?.[0]?.name || null;
    }

    const fullName = profile?.full_name || user.name || user.email?.split('@')[0] || 'Pastor';

    return NextResponse.json({
      data: { ...user, name: fullName, cell_name: cellName },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/auth/me]', err);
    return NextResponse.json({ data: null, error: { message: 'Internal error' } }, { status: 500 });
  }
}
