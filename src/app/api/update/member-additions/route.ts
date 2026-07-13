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

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const cell_id = user.cell_id;
    const body = await req.json();
    const { full_name, phone, email, date_of_birth, gender, join_date } = body;

    if (!full_name) return NextResponse.json({ data: null, error: { message: 'Full name is required' } }, { status: 400 });

    // Get fellowship_id from users table
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs() });
    const userData = await userRes.json();
    const fellowship_id = userData?.[0]?.fellowship_id || null;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/member_additions`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        full_name: full_name.trim(),
        phone: phone || null,
        email: email || null,
        date_of_birth: date_of_birth || null,
        gender: gender || null,
        cell_id: cell_id || null,
        fellowship_id,
        join_date: join_date || new Date().toISOString().split('T')[0],
        submitted_by: user.id,
        status: 'pending',
      }),
    });
    const data = await res.json();

    // Notify PA
    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify([{
        user_id: user.id,
        type: 'pipeline',
        title: 'New member addition request',
        body: `${full_name} has been submitted for addition to your cell. Pending PA approval.`,
        read: false,
      }]),
    });

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to submit' } }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const cell_id = user.cell_id;
    if (!cell_id) return NextResponse.json({ data: { additions: [] }, error: null });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/member_additions?cell_id=eq.${cell_id}&order=created_at.desc&select=id,full_name,phone,gender,date_of_birth,join_date,status`,
      { headers: hdrs() }
    );
    const data = await res.json();
    return NextResponse.json({ data: { additions: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load' } }, { status: 500 });
  }
}
