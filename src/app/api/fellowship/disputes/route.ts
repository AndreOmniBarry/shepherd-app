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

// Resolve/dismiss a dispute — the other half of the promise this feature's
// own UI copy makes ("The PA will review and resolve within 48 hours").
// Until this existed, nothing anywhere could ever act on a raised dispute:
// the fellowship_head-scoped GET above only ever returns the caller's own
// fellowship's disputes, and a PA/overseer/lead_tech/branch_pastor
// typically has no fellowship_id at all, so even they got an empty list —
// there was no admin view AND no way to change a dispute's status, for
// any role, anywhere in the app. The frontend (fellowship/page.tsx) already
// has full 'resolved'/'dismissed' badge rendering built and waiting for
// real data — this is the missing other end of that wire.
const ADMIN_ROLES = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

export async function PATCH(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Only the PA or an overseer can resolve a dispute' } }, { status: 403 });
    }

    const { id, status } = await req.json();
    if (!id || !['resolved', 'dismissed'].includes(status)) {
      return NextResponse.json({ data: null, error: { message: 'id and a valid status (resolved or dismissed) are required' } }, { status: 400 });
    }

    // attendance_disputes has no church_id of its own — verify via its
    // cell, same transitive-scoping pattern the POST handler above already
    // uses, so an admin can never resolve another church's dispute by id.
    const disputeRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_disputes?id=eq.${id}&select=cell_id&limit=1`, { headers: hdrs() });
    const disputeData = await disputeRes.json();
    const cellId = disputeData?.[0]?.cell_id;
    if (!cellId) return NextResponse.json({ data: null, error: { message: 'Dispute not found' } }, { status: 404 });

    const cellRes = await fetch(`${SUPABASE_URL}/rest/v1/cells?id=eq.${cellId}&church_id=eq.${user.church_id}&select=branch_id&limit=1`, { headers: hdrs() });
    const cellData = await cellRes.json();
    const cell = cellData?.[0];
    if (!cell) return NextResponse.json({ data: null, error: { message: 'Dispute not found' } }, { status: 404 });
    if (user.role === 'branch_pastor' && cell.branch_id !== user.branch_id) {
      return NextResponse.json({ data: null, error: { message: 'Dispute not found' } }, { status: 404 });
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_disputes?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ status }),
    });
    const patchData = await patchRes.json().catch(() => []);
    const updated = Array.isArray(patchData) ? patchData[0] : patchData;
    if (!patchRes.ok || !updated?.id) {
      console.error('[PATCH /api/fellowship/disputes] update failed', patchRes.status, patchData);
      return NextResponse.json({ data: null, error: { message: 'Failed to update dispute' } }, { status: 500 });
    }

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    console.error('[PATCH /api/fellowship/disputes]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to update dispute' } }, { status: 500 });
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

    // attendance_records carries no church_id/fellowship_id of its own —
    // verify the record's cell actually belongs to this caller's own
    // fellowship (and church) before allowing a dispute, otherwise a
    // fellowship head could dispute another fellowship's — or another
    // church's — attendance record just by guessing its id.
    const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=fellowship_id&limit=1`, { headers: hdrs() });
    const memberData = await memberRes.json();
    const fellowship_id = user.fellowship_id || memberData?.[0]?.fellowship_id;
    const cellRes = await fetch(`${SUPABASE_URL}/rest/v1/cells?id=eq.${rec.cell_id}&church_id=eq.${user.church_id}&select=fellowship_id&limit=1`, { headers: hdrs() });
    const cellData = await cellRes.json();
    const cell = cellData?.[0];
    if (!cell || (fellowship_id && cell.fellowship_id !== fellowship_id)) {
      return NextResponse.json({ data: null, error: { message: 'Record not found' } }, { status: 404 });
    }

    const submittedAt = new Date(rec.submitted_at);
    const hoursSince = (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 48) return NextResponse.json({ data: null, error: { message: 'Dispute window has closed. You have 48 hours from submission to raise a dispute.' } }, { status: 403 });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance_disputes`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ record_id, cell_id: rec.cell_id, fellowship_id, raised_by: user.id, dispute_reason: reason, status: 'pending' }),
    });
    const data = await res.json();
    // A failed insert here was never checked (same class of bug found
    // repeatedly this session elsewhere) -- a real PostgREST error would
    // have come back as "data" with error: null at HTTP 201, and the
    // fellowship head raising the dispute would see a false success.
    if (!res.ok) {
      console.error('[POST /api/fellowship/disputes] insert failed:', data);
      return NextResponse.json({ data: null, error: { message: 'Failed to raise dispute' } }, { status: 500 });
    }
    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to raise dispute' } }, { status: 500 });
  }
}
