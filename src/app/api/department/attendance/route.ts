import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { computeSlaGrade } from '@/lib/sla';

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
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── 14-day rolling window check ────────────────────────────────
function isWithinWindow(serviceDateStr: string): boolean {
  const serviceDate = new Date(serviceDateStr + 'T00:00:00');
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - 14);
  return serviceDate >= cutoff && serviceDate <= now;
}

async function getDepartmentId(userId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=department_id&limit=1`, { headers: hdrs() });
  const data = await res.json();
  return data?.[0]?.department_id || null;
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Authentication required' } }, { status: 401 });
    if (user.role !== 'department_head') return NextResponse.json({ data: null, error: { message: 'Department heads only' } }, { status: 403 });

    const body = await req.json();
    const { service_date, entries, visitor_count, absence_reasons } = body;
    const service_number = Math.max(1, Math.min(10, Number(body.service_number) || 1));

    if (!service_date || !entries?.length) {
      return NextResponse.json({ data: null, error: { message: 'service_date and entries are required' } }, { status: 400 });
    }

    const department_id = await getDepartmentId(user.id);
    if (!department_id) return NextResponse.json({ data: null, error: { message: 'No department assigned to your account' } }, { status: 400 });

    if (!isWithinWindow(service_date)) {
      return NextResponse.json({ data: null, error: { message: 'That date is outside the submission window. Contact your administrator.' } }, { status: 403 });
    }

    // Find or create the services row for this exact date and service
    // number — reuse an already-sanctioned date (regular or special-day,
    // e.g. a vigil) as-is and skip the day-of-week check entirely; that
    // check only exists to stop backdating to an arbitrary, never-
    // sanctioned day.
    const existingSvcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=eq.${service_date}&service_number=eq.${service_number}&church_id=eq.${user.church_id}&select=id&limit=1`,
      { headers: hdrs() }
    );
    const existingSvc = await existingSvcRes.json();
    let realServiceId: string | null = existingSvc?.[0]?.id || null;

    if (!realServiceId) {
      // Server derives the real day-of-week and cross-checks against the
      // church's own configured service days — universal, works whatever
      // weekdays this church actually picked.
      const [y, mo, d] = service_date.split('-').map(Number);
      const dateObj = new Date(y, mo - 1, d);
      const dayName = DAY_NAMES[dateObj.getDay()];

      let serviceDays: string[] = ['Sunday'];
      if (user.branch_id) {
        const branchRes = await fetch(`${SUPABASE_URL}/rest/v1/branches?id=eq.${user.branch_id}&select=service_days&limit=1`, { headers: hdrs() });
        const branchData = await branchRes.json();
        if (branchData?.[0]?.service_days?.length) serviceDays = branchData[0].service_days;
      } else {
        const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config?select=service_days&church_id=eq.${user.church_id}&limit=1`, { headers: hdrs() });
        const cfgData = await cfgRes.json();
        if (cfgData?.[0]?.service_days?.length) serviceDays = cfgData[0].service_days;
      }
      if (!serviceDays.includes(dayName)) {
        return NextResponse.json({ data: null, error: { message: `${dayName} isn't one of your church's configured service days (${serviceDays.join(', ')}). If this is a special program, ask an admin to add it first under Service Planner.` } }, { status: 400 });
      }
      const service_type = dayName === serviceDays[0] ? 'sunday' : 'midweek';

      const insertSvcRes = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
        method: 'POST', headers: { ...hdrs(), 'Prefer': 'return=representation' },
        body: JSON.stringify({ service_date, service_number, service_type, notes: 'Auto-created on first submission', church_id: user.church_id || null }),
      });
      const insertedSvc = await insertSvcRes.json();
      realServiceId = Array.isArray(insertedSvc) && insertedSvc[0]?.id ? insertedSvc[0].id : null;
      if (!realServiceId) {
        const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/services?service_date=eq.${service_date}&service_number=eq.${service_number}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: hdrs() });
        const retryData = await retryRes.json();
        realServiceId = retryData?.[0]?.id || null;
      }
      if (!realServiceId) return NextResponse.json({ data: null, error: { message: 'Could not create or find service record' } }, { status: 500 });
    }

    // ── Check for duplicate submission ─────────────────────────
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/department_attendance?service_id=eq.${realServiceId}&department_id=eq.${department_id}&select=id,is_locked&limit=1`,
      { headers: hdrs() }
    );
    const existing = await checkRes.json();
    if (existing?.[0]?.is_locked) {
      return NextResponse.json({ data: null, error: { message: 'Attendance locked by administrator' } }, { status: 409 });
    }
    if (existing?.[0]) {
      return NextResponse.json({ data: null, error: { message: 'Attendance already submitted for this service' } }, { status: 409 });
    }

    const present_count = entries.filter((e: Record<string, string>) => e.status === 'present').length;
    const absent_count = entries.filter((e: Record<string, string>) => e.status === 'absent').length;
    const submittedAt = new Date().toISOString();
    // Universal, day-independent — same computeSlaGrade used everywhere
    // else, instead of a lookup table tied to specific weekdays.
    const sla_grade = computeSlaGrade(`${service_date}T00:00:00`, submittedAt);

    // ── Insert department attendance record ─────────────────────
    const recRes = await fetch(`${SUPABASE_URL}/rest/v1/department_attendance`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        service_id: realServiceId,
        department_id,
        submitted_by: user.id,
        present_count,
        absent_count,
        visitor_count: visitor_count || 0,
        is_locked: false,
        submitted_at: submittedAt,
        sla_grade,
      }),
    });
    const recData = await recRes.json();
    const record = Array.isArray(recData) ? recData[0] : recData;

    if (!recRes.ok || !record?.id) {
      console.error('Failed to insert department attendance record:', recData);
      return NextResponse.json({ data: null, error: { message: 'Failed to save attendance record' } }, { status: 500 });
    }

    // ── Insert attendance entries with absence reasons ──────────
    if (entries.length > 0) {
      const entryRows = entries.map((e: Record<string, string>) => ({
        record_id: record.id,
        member_id: e.member_id || null,
        status: e.status,
        absence_reason: e.status === 'absent' ? (absence_reasons?.[e.member_id] || 'unknown') : null,
      }));
      await fetch(`${SUPABASE_URL}/rest/v1/department_attendance_entries`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(entryRows),
      });
    }

    return NextResponse.json({
      data: {
        record_id: record.id,
        present_count,
        absent_count,
        visitor_count: visitor_count || 0,
        submitted_at: submittedAt,
        sla_grade,
      },
      error: null,
    }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/department/attendance]', err);
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

    let url = `${SUPABASE_URL}/rest/v1/department_attendance?submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=200&select=id,service_id,department_id,present_count,absent_count,visitor_count,submitted_at,sla_grade,services(service_date,service_number),departments(name)`;

    if (user.role === 'department_head') {
      const department_id = await getDepartmentId(user.id);
      if (!department_id) return NextResponse.json({ data: { records: [] }, error: null });
      url += `&department_id=eq.${department_id}`;
    } else {
      // department_attendance carries no church_id of its own, so scope it
      // via the departments that belong to this caller's church — otherwise
      // an admin dashboard would leak every church's department attendance.
      const deptsRes = await fetch(`${SUPABASE_URL}/rest/v1/departments?church_id=eq.${user.church_id}&select=id`, { headers: hdrs() });
      const deptRows: { id: string }[] = await deptsRes.json();
      const deptIds = (Array.isArray(deptRows) ? deptRows : []).map(d => d.id);
      url += deptIds.length > 0 ? `&department_id=in.(${deptIds.join(',')})` : '&department_id=eq.00000000-0000-0000-0000-000000000000';
    }

    const res = await fetch(url, { headers: hdrs() });
    const data = await res.json();
    return NextResponse.json({ data: { records: Array.isArray(data) ? data : [] }, error: null });

  } catch (err) {
    console.error('[GET /api/department/attendance]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to fetch attendance' } }, { status: 500 });
  }
}
