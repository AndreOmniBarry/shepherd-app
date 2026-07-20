export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// GET — list all invites (lead_tech and pa only)
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech', 'pa', 'overseer'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/invites?order=created_at.desc&limit=100&select=id,email,full_name,role,used,expires_at,created_at,cell_id,fellowship_id,department_id,cells(name),fellowships(name),departments(name)`,
      { headers: hdrs() }
    );
    const data = await res.json();
    const invites = (Array.isArray(data) ? data : []).map((inv: Record<string, unknown>) => ({
      id: inv.id,
      email: inv.email,
      full_name: inv.full_name,
      role: inv.role,
      used: inv.used,
      expires_at: inv.expires_at,
      created_at: inv.created_at,
      unit_name: (inv.cells as Record<string, string>|null)?.name ||
                 (inv.fellowships as Record<string, string>|null)?.name ||
                 (inv.departments as Record<string, string>|null)?.name || '—',
      expired: new Date(inv.expires_at as string) < new Date(),
    }));

    return NextResponse.json({ data: { invites }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load invites' } }, { status: 500 });
  }
}

// POST — create a new invite
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech', 'pa', 'overseer'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized to create invites' } }, { status: 403 });
    }

    const body = await req.json();
    const { email, full_name, role, cell_id, fellowship_id, department_id } = body;

    if (!email || !full_name || !role) {
      return NextResponse.json({ data: null, error: { message: 'Email, name and role are required' } }, { status: 400 });
    }

    // Check if uninvited invite already exists for this email
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invites?email=eq.${encodeURIComponent(email)}&used=eq.false&select=id,expires_at&limit=1`,
      { headers: hdrs() }
    );
    const existing = await checkRes.json();
    if (existing?.[0] && new Date(existing[0].expires_at) > new Date()) {
      return NextResponse.json({ data: null, error: { message: 'An active invite already exists for this email. Resend or wait for it to expire.' } }, { status: 409 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/invites`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        full_name: full_name.trim(),
        role,
        cell_id: cell_id || null,
        fellowship_id: fellowship_id || null,
        department_id: department_id || null,
        created_by: user.id,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    });
    const data = await res.json();
    const invite = Array.isArray(data) ? data[0] : data;

    if (!invite?.id) {
      return NextResponse.json({ data: null, error: { message: 'Failed to create invite' } }, { status: 500 });
    }

    // Build invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shepherd-app-beta.vercel.app';
    const inviteLink = `${baseUrl}/register?token=${invite.token}`;

    return NextResponse.json({
      data: { invite, invite_link: inviteLink },
      error: null,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to create invite' } }, { status: 500 });
  }
}

// DELETE — revoke an invite
export async function DELETE(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech', 'pa', 'overseer'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ data: null, error: { message: 'Invite ID required' } }, { status: 400 });

    await fetch(`${SUPABASE_URL}/rest/v1/invites?id=eq.${id}`, {
      method: 'DELETE',
      headers: hdrs(),
    });

    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to revoke invite' } }, { status: 500 });
  }
}
