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

// Every logged-in user editing their own name/password — not an admin editing
// someone else's record. Fixes Excel-import typos (wrong first/last name) and
// lets people get off their temporary password without waiting on an admin.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=id,full_name,email,role`, { headers: hdrs() });
  const rows = await res.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile) return NextResponse.json({ data: null, error: { message: 'Profile not found' } }, { status: 404 });
  return NextResponse.json({ data: { profile }, error: null });
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { full_name, current_password, new_password } = await req.json();
    let updatedName: string | null = null;

    if (full_name !== undefined) {
      const trimmed = String(full_name).trim();
      if (!trimmed) return NextResponse.json({ data: null, error: { message: 'Name cannot be empty' } }, { status: 400 });
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify({ full_name: trimmed }),
      });
      updatedName = trimmed;
    }

    if (new_password) {
      if (!current_password) return NextResponse.json({ data: null, error: { message: 'Current password is required to set a new one' } }, { status: 400 });
      if (String(new_password).length < 8) return NextResponse.json({ data: null, error: { message: 'New password must be at least 8 characters' } }, { status: 400 });

      // Verify the current password by attempting a real sign-in with it —
      // the only way to confirm it without storing/decrypting it ourselves.
      const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: hdrs(),
        body: JSON.stringify({ email: user.email, password: current_password }),
      });
      if (!verifyRes.ok) return NextResponse.json({ data: null, error: { message: 'Current password is incorrect' } }, { status: 401 });

      const resetRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'PUT', headers: hdrs(), body: JSON.stringify({ password: new_password }),
      });
      if (!resetRes.ok) return NextResponse.json({ data: null, error: { message: 'Failed to update password' } }, { status: 500 });
    }

    const res = NextResponse.json({ data: { updated: true, full_name: updatedName }, error: null });

    // Name is embedded in the JWT (used for the header greeting) — re-sign so
    // the change shows up immediately without forcing a re-login.
    if (updatedName) {
      const token = await signToken({
        id: user.id, email: user.email, role: user.role,
        cell_id: user.cell_id, fellowship_id: user.fellowship_id, name: updatedName,
      });
      res.cookies.set('shepherd_token', token, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7200, path: '/',
      });
    }

    return res;
  } catch (err) {
    console.error('[PATCH /api/profile]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update profile' } }, { status: 500 });
  }
}
