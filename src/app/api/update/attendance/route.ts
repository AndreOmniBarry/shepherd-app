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

// GET — fetch existing monthly attendance records for this cell
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const cell_id = user.cell_id;
    if (!cell_id) return NextResponse.json({ data: { records: [] }, error: null });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/monthly_attendance?cell_id=eq.${cell_id}&order=month.asc,member_id.asc&select=id,member_id,month,times_present,times_absent,total_services,exit_type,exit_date,status,notes`,
      { headers: hdrs() }
    );
    const data = await res.json();
    return NextResponse.json({ data: { records: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load records' } }, { status: 500 });
  }
}

// POST — submit monthly attendance records for a batch of members
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const cell_id = user.cell_id;
    if (!cell_id) return NextResponse.json({ data: null, error: { message: 'No cell assigned' } }, { status: 400 });

    const body = await req.json();
    const { records } = body;

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ data: null, error: { message: 'No records provided' } }, { status: 400 });
    }

    const rows = records.map((r: Record<string, unknown>) => ({
      member_id: r.member_id,
      cell_id,
      month: r.month,
      service_type: r.service_type || 'sunday',
      times_present: parseInt(r.times_present as string) || 0,
      times_absent: parseInt(r.times_absent as string) || 0,
      total_services: parseInt(r.total_services as string) || 0,
      exit_type: r.exit_type || 'none',
      exit_date: r.exit_date || null,
      notes: r.notes || null,
      submitted_by: user.id,
      status: 'pending',
    }));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/monthly_attendance`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ data: null, error: { message: 'Failed to save records' } }, { status: 500 });
    }

    return NextResponse.json({ data: { saved: rows.length }, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to save' } }, { status: 500 });
  }
}
