import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1] || req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const headers = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Authentication required' } }, { status: 401 });
    if (user.role !== 'cell_leader') return NextResponse.json({ data: null, error: { message: 'Cell leaders only' } }, { status: 403 });

    const body = await req.json();
    const { service_id, entries, visitor_count } = body;

    if (!service_id || !entries?.length) {
      return NextResponse.json({ data: null, error: { message: 'service_id and entries are required' } }, { status: 400 });
    }

    const cell_id = user.cell_id;
    if (!cell_id) return NextResponse.json({ data: null, error: { message: 'No cell assigned to your account' } }, { status: 400 });

    const present_count = entries.filter((e: Record<string,string>) => e.status === 'present').length;
    const absent_count = entries.filter((e: Record<string,string>) => e.status === 'absent').length;

    // Check for duplicate
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?service_id=eq.${service_id}&cell_id=eq.${cell_id}&select=id,is_locked&limit=1`,
      { headers: headers() }
    );
    const existing = await checkRes.json();
    if (existing?.[0]?.is_locked) return NextResponse.json({ data: null, error: { message: 'Attendance locked by administrator' } }, { status: 409 });
    if (existing?.[0]) return NextResponse.json({ data: null, error: { message: 'Attendance already submitted for this service' } }, { status: 409 });

    // Insert record
    const recRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_records`, {
      method: 'POST',
      headers: { ...headers(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ service_id, cell_id, submitted_by: user.id, present_count, absent_count, visitor_count: visitor_count || 0, is_locked: false }),
    });
    const recData = await recRes.json();
    const record = Array.isArray(recData) ? recData[0] : recData;

    if (!recRes.ok || !record?.id) {
      return NextResponse.json({ data: null, error: { message: 'Failed to save attendance record' } }, { status: 500 });
    }

    // Insert entries
    if (entries.length > 0) {
      const entryRows = entries.map((e: Record<string,string>) => ({
        record_id: record.id,
        member_id: e.member_id || null,
        status: e.status,
        absence_reason: e.absence_reason || null,
      }));
      await fetch(`${SUPABASE_URL}/rest/v1/attendance_entries`, {
        method: 'POST',
        headers: { ...headers(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(entryRows),
      });
    }

    return NextResponse.json({
      data: { record_id: record.id, present_count, absent_count, visitor_count: visitor_count || 0, submitted_at: new Date().toISOString() },
      error: null,
    }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/attendance]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to submit attendance' } }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Authentication required' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    let url = `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=200&select=id,service_id,cell_id,present_count,absent_count,visitor_count,submitted_at,services(service_date,service_number),cells(name)`;
    if (user.role === 'cell_leader' && user.cell_id) {
      url += `&cell_id=eq.${user.cell_id}`;
    }

    const res = await fetch(url, { headers: headers() });
    const data = await res.json();

    return NextResponse.json({ data: { records: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    console.error('[GET /api/attendance]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to fetch attendance' } }, { status: 500 });
  }
}
