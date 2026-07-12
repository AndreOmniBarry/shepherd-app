import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getFellowshipId(userId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${userId}&select=fellowship_id&limit=1`, { headers: hdrs() });
  const data = await res.json();
  return data?.[0]?.fellowship_id || null;
}

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);

    const fellowship_id = await getFellowshipId(user.id);
    if (!fellowship_id) return NextResponse.json({ data: { records: [] }, error: null });

    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/giving_records?fellowship_id=eq.${fellowship_id}&service_date=gte.${cutoff.toISOString().split('T')[0]}&order=service_date.desc&limit=52`,
      { headers: hdrs() }
    );
    const records = await res.json();
    return NextResponse.json({ data: { records: Array.isArray(records) ? records : [] }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load giving' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);

    const fellowship_id = await getFellowshipId(user.id);
    if (!fellowship_id) return NextResponse.json({ data: null, error: { message: 'No fellowship assigned' } }, { status: 400 });

    const body = await req.json();
    const { tithe, offering, special, project, service_date } = body;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/giving_records`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ fellowship_id, tithe: tithe || 0, offering: offering || 0, special: special || 0, project: project || 0, service_date, submitted_by: user.id }),
    });
    const data = await res.json();
    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to submit giving' } }, { status: 500 });
  }
}
