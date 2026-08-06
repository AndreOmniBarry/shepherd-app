export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });
const ADMIN_ROLES = ['overseer', 'general_overseer', 'lead_tech'];

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Full staff directory for the Team & Access settings panel — admin-only,
// used to pick a user to reset a password for, or to suspend/reinstate.
// Includes suspended (is_active=false) accounts too, not just active ones —
// otherwise a suspended user would vanish from this list the moment
// they're suspended, with no way to see or reverse it from here.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,full_name,email,role,is_active&church_id=eq.${user.church_id}&order=role.asc,full_name.asc${EXCLUDE_DEMO_IDS}`, { headers: hdrs() });
  const data = await res.json();
  return NextResponse.json({ data: { users: Array.isArray(data) ? data : [] }, error: null });
}

// Suspend or reinstate a user — the "I retain the right to permanently
// disable a violating account" capability from the terms of use. Builds on
// the existing users.is_active flag (already checked at login by
// /api/auth/login) rather than a new mechanism: an already-live session
// isn't kicked out mid-session by this alone (that would need a per-request
// DB check on every route, a bigger change than this pass should risk),
// but the account can never log in again from the moment this runs, and
// every action here is written to account_violations as a real audit trail.
export async function PATCH(req: Request) {
  try {
    const admin = await getUser(req);
    if (!admin || !ADMIN_ROLES.includes(admin.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }
    const { userId, action, reason } = await req.json();
    if (!userId || !['suspend', 'reinstate'].includes(action)) {
      return NextResponse.json({ data: null, error: { message: 'userId and a valid action are required' } }, { status: 400 });
    }
    if (action === 'suspend' && !reason?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'A reason is required to suspend an account' } }, { status: 400 });
    }
    if (userId === admin.id) {
      return NextResponse.json({ data: null, error: { message: 'You cannot suspend your own account' } }, { status: 400 });
    }

    const targetRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&church_id=eq.${admin.church_id}&select=id&limit=1`, { headers: hdrs() });
    const targetData = await targetRes.json();
    if (!targetData?.[0]) return NextResponse.json({ data: null, error: { message: 'User not found' } }, { status: 404 });

    const isActive = action === 'reinstate';
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
      body: JSON.stringify({ is_active: isActive }),
    });

    await fetch(`${SUPABASE_URL}/rest/v1/account_violations`, {
      method: 'POST', headers: { ...hdrs(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: userId, church_id: admin.church_id,
        action: action === 'suspend' ? 'suspended' : 'reinstated',
        reason: reason?.trim() || 'Reinstated by admin', actor_id: admin.id,
      }),
    });

    return NextResponse.json({ data: { userId, is_active: isActive }, error: null });
  } catch (err) {
    console.error('[PATCH /api/admin/users]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update account status' } }, { status: 500 });
  }
}
