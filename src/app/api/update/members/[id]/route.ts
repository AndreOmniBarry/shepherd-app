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

const ADMIN_ROLES = ['overseer', 'pa', 'lead_tech'];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Only the pastor or church admin can edit member records' } }, { status: 403 });
    }

    const body = await req.json();
    const { full_name, phone, email, date_of_birth, gender } = body;

    // Only update allowed fields — never cell_id, fellowship_id, membership_status
    const updateData: Record<string, string | null> = {};
    if (full_name) updateData.full_name = full_name.trim();
    if (phone) updateData.phone = phone.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (date_of_birth) updateData.date_of_birth = date_of_birth;
    if (gender) updateData.gender = gender;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ data: null, error: { message: 'No fields to update' } }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${params.id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      return NextResponse.json({ data: null, error: { message: 'Failed to update member' } }, { status: 500 });
    }

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    console.error('[PATCH /api/update/members/[id]]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update' } }, { status: 500 });
  }
}

// Permanent, unrecoverable delete — the pastor's sole prerogative. Cell leaders,
// fellowship heads, and department heads only ever have access to the separate
// "recommend removal" chain (member-removals route), which is reversible and
// requires PA sign-off. This is the one-way door: no approval chain, no undo.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (user.role !== 'overseer') {
      return NextResponse.json({ data: null, error: { message: 'Only the overseer can permanently delete a member' } }, { status: 403 });
    }

    // Clear references before deleting so the delete never fails on a foreign key.
    await fetch(`${SUPABASE_URL}/rest/v1/department_members?member_id=eq.${params.id}`, {
      method: 'DELETE', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
    }).catch(() => {});
    await fetch(`${SUPABASE_URL}/rest/v1/member_additions?created_member_id=eq.${params.id}`, {
      method: 'PATCH', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ created_member_id: null }),
    }).catch(() => {});
    await fetch(`${SUPABASE_URL}/rest/v1/member_removals?member_id=eq.${params.id}`, {
      method: 'PATCH', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ member_id: null }),
    }).catch(() => {});

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${params.id}`, {
      method: 'DELETE', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
    });

    if (!res.ok) {
      return NextResponse.json({ data: null, error: { message: 'Failed to delete member' } }, { status: 500 });
    }
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err) {
    console.error('[DELETE /api/update/members/[id]]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to delete' } }, { status: 500 });
  }
}
