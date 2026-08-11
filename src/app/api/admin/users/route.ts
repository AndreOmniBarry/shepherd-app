export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });
const ADMIN_ROLES = ['overseer', 'general_overseer', 'lead_tech'];

async function getUser(req: Request) {
  return getAuthUser(req);
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,full_name,email,role,is_active,branch_id,branches(name)&church_id=eq.${user.church_id}&order=role.asc,full_name.asc${EXCLUDE_DEMO_IDS}`, { headers: hdrs() });
  const data = await res.json();
  const users = (Array.isArray(data) ? data : []).map((u: Record<string, unknown>) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    is_active: u.is_active,
    branch_id: u.branch_id ?? null,
    branch_name: (u.branches as Record<string, string> | null)?.name || null,
  }));
  return NextResponse.json({ data: { users }, error: null });
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
    const { userId, action, reason, branch_id } = await req.json();
    if (!userId || !['suspend', 'reinstate', 'set_branch'].includes(action)) {
      return NextResponse.json({ data: null, error: { message: 'userId and a valid action are required' } }, { status: 400 });
    }
    if (action === 'suspend' && !reason?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'A reason is required to suspend an account' } }, { status: 400 });
    }
    if (action !== 'set_branch' && userId === admin.id) {
      return NextResponse.json({ data: null, error: { message: 'You cannot suspend your own account' } }, { status: 400 });
    }

    const targetRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&church_id=eq.${admin.church_id}&select=id&limit=1`, { headers: hdrs() });
    const targetData = await targetRes.json();
    if (!targetData?.[0]) return NextResponse.json({ data: null, error: { message: 'User not found' } }, { status: 404 });

    // Reassign (or clear) which branch this user belongs to — the
    // "existing user" counterpart to setting branch_id at invite time.
    // branch_id is client-supplied — verify it belongs to this admin's own
    // church before use (or allow null to unassign), same ownership-check
    // pattern used at invite creation.
    if (action === 'set_branch') {
      if (branch_id) {
        const branchCheck = await fetch(
          `${SUPABASE_URL}/rest/v1/branches?id=eq.${branch_id}&church_id=eq.${admin.church_id}&select=id&limit=1`,
          { headers: hdrs() }
        ).then(r => r.json());
        if (!branchCheck?.[0]) return NextResponse.json({ data: null, error: { message: 'Branch not found' } }, { status: 404 });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify({ branch_id: branch_id || null }),
      });
      return NextResponse.json({ data: { userId, branch_id: branch_id || null }, error: null });
    }

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
