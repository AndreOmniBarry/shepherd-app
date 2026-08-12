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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,full_name,email,role,is_active,branch_id,branches(name),finance_access_granted&church_id=eq.${user.church_id}&order=role.asc,full_name.asc${EXCLUDE_DEMO_IDS}`, { headers: hdrs() });
  const data = await res.json();
  const users = (Array.isArray(data) ? data : []).map((u: Record<string, unknown>) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    is_active: u.is_active,
    branch_id: u.branch_id ?? null,
    branch_name: (u.branches as Record<string, string> | null)?.name || null,
    finance_access_granted: !!u.finance_access_granted,
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
    const { userId, action, reason, branch_id, finance_access_granted, full_name, email } = await req.json();
    if (!userId || !['suspend', 'reinstate', 'set_branch', 'set_finance_access', 'edit_profile'].includes(action)) {
      return NextResponse.json({ data: null, error: { message: 'userId and a valid action are required' } }, { status: 400 });
    }
    if (action === 'suspend' && !reason?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'A reason is required to suspend an account' } }, { status: 400 });
    }
    if (!['set_branch', 'set_finance_access', 'edit_profile'].includes(action) && userId === admin.id) {
      return NextResponse.json({ data: null, error: { message: 'You cannot suspend your own account' } }, { status: 400 });
    }

    const targetRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&church_id=eq.${admin.church_id}&select=id,role&limit=1`, { headers: hdrs() });
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

    // Grant/revoke a PA's access to financial/giving routes. Deliberately
    // stricter than the other actions here: only overseer/general_overseer
    // (the GO tier) can flip this, not lead_tech — lead_tech is platform
    // support, not church leadership, and shouldn't be the one deciding who
    // in a church sees its money. Only meaningful for a pa-role account,
    // same as the finance_access_granted column itself.
    if (action === 'set_finance_access') {
      if (!['overseer', 'general_overseer'].includes(admin.role)) {
        return NextResponse.json({ data: null, error: { message: 'Only the overseer or general overseer can change financial access' } }, { status: 403 });
      }
      if (targetData[0].role !== 'pa') {
        return NextResponse.json({ data: null, error: { message: 'Financial access only applies to PA accounts' } }, { status: 400 });
      }
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify({ finance_access_granted: !!finance_access_granted }),
      });
      return NextResponse.json({ data: { userId, finance_access_granted: !!finance_access_granted }, error: null });
    }

    // Data-cleanup tool: fix a user's display name and/or login email —
    // mainly for the batch of leaders imported without a real email on file
    // (scripts/generate_import.py fell back to slugifying their whole name,
    // title included, into "<slug>@shepherd.app"), and for single-word or
    // otherwise ambiguous names. Deliberately restricted tighter than every
    // other action on this route: general_overseer/lead_tech only, not plain
    // overseer or branch_pastor — this can touch any user in the church
    // regardless of branch, and a login email is sensitive enough (it IS
    // the account) that "super-admin only" is the right bar.
    if (action === 'edit_profile') {
      if (!['general_overseer', 'lead_tech'].includes(admin.role)) {
        return NextResponse.json({ data: null, error: { message: 'Only a general overseer or tech admin can edit member profiles' } }, { status: 403 });
      }
      const trimmedName = typeof full_name === 'string' ? full_name.trim() : undefined;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
      if (trimmedName === undefined && normalizedEmail === undefined) {
        return NextResponse.json({ data: null, error: { message: 'Provide a full_name or email to update' } }, { status: 400 });
      }
      if (trimmedName !== undefined && !trimmedName) {
        return NextResponse.json({ data: null, error: { message: 'Name cannot be blank' } }, { status: 400 });
      }
      if (normalizedEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json({ data: null, error: { message: 'Enter a valid email address' } }, { status: 400 });
      }

      const patch: Record<string, unknown> = {};
      if (trimmedName !== undefined) patch.full_name = trimmedName;

      if (normalizedEmail !== undefined) {
        const dupeCheck = await fetch(
          `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&id=neq.${userId}&select=id&limit=1`,
          { headers: hdrs() }
        ).then(r => r.json());
        if (dupeCheck?.[0]) {
          return NextResponse.json({ data: null, error: { message: 'Another account already uses that email' } }, { status: 409 });
        }
        // Login checks two places for a match (see /api/auth/login): the
        // public.users profile row, AND Supabase Auth's own auth.users via
        // the password grant. They must be updated together — changing only
        // the profile row would leave the person able to be found by their
        // new email but unable to ever authenticate with it, since Auth
        // still only recognizes the old one.
        const authUpdateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'PUT', headers: hdrs(), body: JSON.stringify({ email: normalizedEmail, email_confirm: true }),
        });
        if (!authUpdateRes.ok) {
          const errText = await authUpdateRes.text().catch(() => '');
          console.error('[PATCH /api/admin/users edit_profile] auth email update failed', authUpdateRes.status, errText);
          return NextResponse.json({ data: null, error: { message: 'Could not update the login email — the profile was left unchanged so the two never go out of sync.' } }, { status: 502 });
        }
        patch.email = normalizedEmail;
      }

      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      return NextResponse.json({ data: { userId, ...patch }, error: null });
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
