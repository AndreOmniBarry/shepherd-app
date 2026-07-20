export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);

    const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs() });
    const memberData = await memberRes.json();
    const fellowship_id = user.fellowship_id || memberData?.[0]?.fellowship_id;
    if (!fellowship_id) return NextResponse.json({ data: { disputes: [] }, error: null });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_disputes?fellowship_id=eq.${fellowship_id}&order=created_at.desc&limit=50&select=id,cell_id,dispute_reason,status,created_at,attendance_records(present_count,absent_count,services(service_date)),cells(name,members(full_name))`,
      { headers: hdrs() }
    );
    const data = await res.json();
    const disputes = (Array.isArray(data) ? data : []).map((d: Record<string, unknown>) => {
      const rec = d.attendance_records as Record<string, unknown> | null;
      const svc = rec?.services as Record<string, unknown> | null;
      const cell = d.cells as Record<string, unknown> | null;
      const leader = cell?.members as Record<string, string> | null;
      return {
        id: d.id,
        cell_name: cell?.name || '—',
        leader_name: leader?.full_name || '—',
        service_date: (svc?.service_date as string) || '—',
        original_present: rec?.present_count || 0,
        original_absent: rec?.absent_count || 0,
        dispute_reason: d.dispute_reason,
        status: d.status,
        submitted_at: d.created_at,
      };
    });

    return NextResponse.json({ data: { disputes }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load disputes' } }, { status: 500 });
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

    const body = await req.json();
    const { record_id, reason } = body;
    if (!record_id || !reason) return NextResponse.json({ data: null, error: { message: 'record_id and reason required' } }, { status: 400 });

    // Check 48-hour window
    const recRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_records?id=eq.${record_id}&select=submitted_at,cell_id&limit=1`, { headers: hdrs() });
    const recData = await recRes.json();
    const rec = recData?.[0];
    if (!rec) return NextResponse.json({ data: null, error: { message: 'Record not found' } }, { status: 404 });

    const submittedAt = new Date(rec.submitted_at);
    const hoursSince = (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 48) return NextResponse.json({ data: null, error: { message: 'Dispute window has closed. You have 48 hours from submission to raise a dispute.' } }, { status: 403 });

    // Get fellowship_id
    const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs() });
    const memberData = await memberRes.json();
    const fellowship_id = user.fellowship_id || memberData?.[0]?.fellowship_id;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance_disputes`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ record_id, cell_id: rec.cell_id, fellowship_id, raised_by: user.id, dispute_reason: reason, status: 'pending' }),
    });
    const data = await res.json();
    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to raise dispute' } }, { status: 500 });
  }
}
