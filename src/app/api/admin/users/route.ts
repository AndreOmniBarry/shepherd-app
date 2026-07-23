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

// Full staff directory for the Team & Access settings panel — admin-only,
// used to pick a user to reset a password for.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,full_name,email,role&is_active=eq.true&order=role.asc,full_name.asc`, { headers: hdrs() });
  const data = await res.json();
  return NextResponse.json({ data: { users: Array.isArray(data) ? data : [] }, error: null });
}
