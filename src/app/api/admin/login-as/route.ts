export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser, signToken } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

const PORTAL_PATH: Record<string, string> = {
  overseer: '/dashboard', pa: '/dashboard', lead_tech: '/dashboard',
  fellowship_head: '/fellowship', department_head: '/department', cell_leader: '/cell',
  care_team: '/care', accounts: '/accounts', partnership: '/partnership', workforce: '/workforce',
};

// Real, full-access impersonation — any leader, any cell, any department,
// not a fixed read-only demo account. Restricted to the top-tier admin roles
// (overseer, general_overseer, lead_tech) so they can help a real leader who
// is stuck without ever touching that person's password: no password is
// generated, seen, or stored anywhere,
// it's a straight session swap. Reuses the same shepherd_admin_token
// stash/restore pair as the existing read-only portal preview, so "Exit
// preview -> back to my account" (MyAccountButton) already works unchanged.
export async function POST(req: Request) {
  try {
    const admin = await getUser(req);
    if (!admin || !['overseer', 'general_overseer', 'lead_tech'].includes(admin.role)) {
      return NextResponse.json({ data: null, error: { message: 'You do not have permission to log in as another user' } }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ data: null, error: { message: 'userId is required' } }, { status: 400 });

    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,email,full_name,role,cell_id,fellowship_id,member_id,branch_id,church_id,is_active&limit=1`, { headers: hdrs() });
    const profRows = await profRes.json();
    const target = Array.isArray(profRows) ? profRows[0] : null;
    if (!target) return NextResponse.json({ data: null, error: { message: 'User not found' } }, { status: 404 });
    if (!target.is_active) return NextResponse.json({ data: null, error: { message: 'That account is inactive' } }, { status: 400 });
    // Cross-church login-as is never allowed, even for lead_tech/overseer —
    // each church's data is isolated from every other church's.
    if (admin.church_id && target.church_id && admin.church_id !== target.church_id) {
      return NextResponse.json({ data: null, error: { message: 'That user belongs to a different church' } }, { status: 403 });
    }

    const token = await signToken({
      id: target.id, email: target.email, role: target.role,
      cell_id: target.cell_id || null, fellowship_id: target.fellowship_id || null,
      member_id: target.member_id || null, branch_id: target.branch_id || null,
      church_id: target.church_id || null,
      name: target.full_name,
    });

    console.log(`[login-as] ${admin.role} ${admin.id} logged in as ${target.role} ${target.id} (${target.full_name})`);

    const res = NextResponse.json({ data: { path: PORTAL_PATH[target.role] || '/dashboard', full_name: target.full_name, role: target.role }, error: null });

    const cookieHeader = req.headers.get('cookie') || '';
    if (!/shepherd_admin_token=/.test(cookieHeader)) {
      const realToken = cookieHeader.match(/shepherd_token=([^;]+)/)?.[1];
      if (realToken) {
        res.cookies.set('shepherd_admin_token', realToken, {
          httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7200, path: '/',
        });
      }
    }
    res.cookies.set('shepherd_token', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7200, path: '/',
    });

    return res;
  } catch (err) {
    console.error('[POST /api/admin/login-as]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to log in as user' } }, { status: 500 });
  }
}
