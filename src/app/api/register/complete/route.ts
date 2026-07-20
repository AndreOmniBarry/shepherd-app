export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

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
      `${SUPABASE_URL}/rest/v1/invites?token=eq.${token}&select=id,email,full_name,role,used,expires_at,cell_id,fellowship_id,department_id&limit=1`,
      { headers: hdrs() }
    );
    const inviteData = await inviteRes.json();
    const invite = inviteData?.[0];

    if (!invite) return NextResponse.json({ data: null, error: { message: 'Invalid invite token' } }, { status: 404 });
    if (invite.used) return NextResponse.json({ data: null, error: { message: 'Invite already used' } }, { status: 410 });
    if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ data: null, error: { message: 'Invite has expired' } }, { status: 410 });

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
        cell_id: invite.cell_id || null,
        fellowship_id: invite.fellowship_id || null,
        department_id: invite.department_id || null,
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
    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify([{
        user_id: userId,
        type: 'system',
        title: `Welcome to SHEP.HERD, ${invite.full_name.split(' ')[0]}`,
        body: `Your account has been activated as ${invite.role.replace('_', ' ')}. Log in to get started.`,
        read: false,
      }]),
    });

    return NextResponse.json({ data: { success: true, email: invite.email }, error: null });
  } catch (err) {
    console.error('[POST /api/register/complete]', err);
    return NextResponse.json({ data: null, error: { message: 'Registration failed' } }, { status: 500 });
  }
}
