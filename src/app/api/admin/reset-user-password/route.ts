export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });
const ADMIN_ROLES = ['overseer', 'pa', 'lead_tech'];

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

function genPassword() {
  return 'Shep' + Math.random().toString(36).slice(2, 8) + '!' + Math.floor(Math.random() * 90 + 10);
}

// Lets an admin issue a brand-new password for one struggling user on the
// spot, without them going through the self-serve reset flow. The password
// is generated here, set on the account, and returned once in this response
// only — nothing is written to logs, a table, or a file, so there is no
// stored record of it after the admin reads it off the screen.
export async function POST(req: Request) {
  try {
    const admin = await getUser(req);
    if (!admin || !ADMIN_ROLES.includes(admin.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ data: null, error: { message: 'userId is required' } }, { status: 400 });

    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=id,full_name,email,role`, { headers: hdrs() });
    const profRows = await profRes.json();
    const profile = Array.isArray(profRows) ? profRows[0] : null;
    if (!profile) return NextResponse.json({ data: null, error: { message: 'User not found' } }, { status: 404 });

    const password = genPassword();
    const resetRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT', headers: hdrs(), body: JSON.stringify({ password }),
    });
    if (!resetRes.ok) return NextResponse.json({ data: null, error: { message: 'Failed to set new password' } }, { status: 500 });

    return NextResponse.json({ data: { full_name: profile.full_name, email: profile.email, password }, error: null });
  } catch (err) {
    console.error('[POST /api/admin/reset-user-password]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to reset password' } }, { status: 500 });
  }
}
