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

async function getOverseerIds(): Promise<string[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa)&is_active=eq.true&select=id`,
    { headers: hdrs() }
  );
  const data = await res.json();
  return Array.isArray(data) ? data.map((u: Record<string,string>) => u.id) : [];
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === 'true';

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);

    // Overseer/PA can see all; care team sees recent
    const isAdmin = ['overseer', 'pa', 'lead_tech'].includes(user.role);
    let url = `${SUPABASE_URL}/rest/v1/first_timers?order=created_at.desc&limit=200&select=id,full_name,phone,how_they_came,service_date,status,notes,assigned_to`;
    if (!isAdmin || !all) {
      url += `&service_date=gte.${cutoff.toISOString().split('T')[0]}`;
    }

    const res = await fetch(url, { headers: hdrs() });
    const data = await res.json();
    return NextResponse.json({ data: { first_timers: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load first timers' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { full_name, phone, how_they_came, notes, service_date } = body;

    if (!full_name || !phone) {
      return NextResponse.json({ data: null, error: { message: 'Name and phone are required' } }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/first_timers`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        full_name, phone,
        how_they_came: how_they_came || 'walk_in',
        notes: notes || null,
        service_date: service_date || new Date().toISOString().split('T')[0],
        assigned_to: user.id,
        status: 'new',
      }),
    });
    const data = await res.json();

    // FIX E10: Notify overseers/PAs about new first timer
    const overseerIds = await getOverseerIds();
    if (overseerIds.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(overseerIds.map(uid => ({
          user_id: uid,
          type: 'pipeline',
          title: 'New first timer logged',
          body: `${full_name} (${phone}) — logged by care team`,
          read: false,
        }))),
      });
    }

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to add first timer' } }, { status: 500 });
  }
}
