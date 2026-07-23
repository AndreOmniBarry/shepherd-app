export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { sendSMS, welcomeMessage } from '@/lib/sms';

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

// Pastor/PA/lead_tech creating a member directly — goes live immediately,
// no approval chain (unlike POST /api/update/member-additions, which is for
// cell leaders/fellowship heads/dept heads and requires L1/L2 sign-off).
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Only the pastor or church admin can create a member directly' } }, { status: 403 });
    }

    const body = await req.json();
    const { full_name, phone, email, gender, date_of_birth, address, occupation, cell_id, fellowship_id, department_id } = body;
    if (!full_name?.trim()) return NextResponse.json({ data: null, error: { message: 'Full name is required' } }, { status: 400 });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        full_name: full_name.trim(),
        phone: phone || null,
        email: email || null,
        gender: gender || null,
        date_of_birth: date_of_birth || null,
        address: address || null,
        occupation: occupation || null,
        cell_id: cell_id || null,
        fellowship_id: fellowship_id || null,
        membership_status: 'active',
        join_date: new Date().toISOString().split('T')[0],
      }),
    });
    const data = await res.json();
    const member = Array.isArray(data) ? data[0] : data;
    if (!res.ok || !member?.id) {
      console.error('[POST /api/members/create]', data);
      return NextResponse.json({ data: null, error: { message: 'Failed to create member' } }, { status: 500 });
    }

    if (department_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/department_members`, {
        method: 'POST', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ department_id, member_id: member.id, role: 'member' }),
      }).catch(() => {});
    }

    if (member.phone) sendSMS(member.phone, welcomeMessage(member.full_name)).catch(() => {});

    return NextResponse.json({ data: { member }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/members/create]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create member' } }, { status: 500 });
  }
}
