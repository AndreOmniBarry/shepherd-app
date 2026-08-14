import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { notifyUsers } from '@/lib/notify';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ data: null, error: { message: 'Token and password (min 8 chars) are required' } }, { status: 400 });
    }

    // Fetch and validate invite
    const inviteRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invites?token=eq.${token}&select=id,email,full_name,role,used,expires_at,cell_id,fellowship_id,department_id,member_id,church_id,branch_id&limit=1`,
      { headers: hdrs() }
    );
    const inviteData = await inviteRes.json();
    const invite = inviteData?.[0];

    if (!invite) return NextResponse.json({ data: null, error: { message: 'Invalid invite token' } }, { status: 404 });
    if (invite.used) return NextResponse.json({ data: null, error: { message: 'Invite already used' } }, { status: 410 });
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ data: null, error: { message: 'Invite has expired' } }, { status: 410 });

    // A `single`-structure church has exactly one fellowship + one cell,
    // auto-provisioned for the founding user at bootstrap time (see
    // bootstrapChurch in /api/settings/church-config) — but nothing sets
    // cell_id/fellowship_id on anyone invited afterward, because the
    // invite-creation UI never shows a cell/fellowship picker for
    // non-cell_leader roles. Attendance submission for this structure
    // type reads cell_id straight off the user's own row (see /cell
    // page's fetch of /api/auth/me), so a second admin invited into a
    // single-structure church would land with cell_id: null and be
    // unable to record attendance at all despite being an allowed role
    // (/api/attendance's ADMIN_ROLES check). Backfill both ids here from
    // the church's one cell/fellowship whenever the invite didn't
    // already carry them and the church is actually single-structure.
    let resolvedCellId = invite.cell_id || null;
    let resolvedFellowshipId = invite.fellowship_id || null;
    if (!resolvedCellId && invite.church_id) {
      const cfgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${invite.church_id}&select=structure_type&limit=1`,
        { headers: hdrs() }
      );
      const cfgData = await cfgRes.json();
      if (cfgData?.[0]?.structure_type === 'single') {
        const cellRes = await fetch(
          `${SUPABASE_URL}/rest/v1/cells?church_id=eq.${invite.church_id}&select=id,fellowship_id&limit=1`,
          { headers: hdrs() }
        );
        const cellData = await cellRes.json();
        const cell = cellData?.[0];
        if (cell?.id) {
          resolvedCellId = cell.id;
          resolvedFellowshipId = resolvedFellowshipId || cell.fellowship_id || null;
        }
      }
    }

    // Create auth user in Supabase
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: invite.full_name, role: invite.role },
      }),
    });
    const authData = await authRes.json();

    if (!authRes.ok || !authData.id) {
      // User might already exist in auth
      if (authData.msg?.includes('already been registered')) {
        return NextResponse.json({ data: null, error: { message: 'An account with this email already exists. Try logging in.' } }, { status: 409 });
      }
      return NextResponse.json({ data: null, error: { message: 'Failed to create account. Please try again.' } }, { status: 500 });
    }

    const userId = authData.id;

    // Insert into users table
    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        id: userId,
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role,
        cell_id: resolvedCellId,
        fellowship_id: resolvedFellowshipId,
        department_id: invite.department_id || null,
        member_id: invite.member_id || null,
        church_id: invite.church_id || null,
        branch_id: invite.branch_id || null,
        is_active: true,
      }),
    });

    // Mark invite as used
    await fetch(`${SUPABASE_URL}/rest/v1/invites?id=eq.${invite.id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ used: true, used_at: new Date().toISOString() }),
    });

    // Send welcome notification
    await notifyUsers([userId], {
      type: 'system',
      title: `Welcome to SHEP.HERD, ${invite.full_name.split(' ')[0]}`,
      body: `Your account has been activated as ${invite.role.replace('_', ' ')}. Log in to get started.`,
    }, invite.church_id);

    return NextResponse.json({ data: { success: true, email: invite.email }, error: null });
  } catch (err) {
    console.error('[POST /api/register/complete]', err);
    return NextResponse.json({ data: null, error: { message: 'Registration failed' } }, { status: 500 });
  }
}
