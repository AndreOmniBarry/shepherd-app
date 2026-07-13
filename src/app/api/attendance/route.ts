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
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// ── 7-day rolling window check ─────────────────────────────────
function isWithinWindow(serviceDateStr: string): boolean {
  const serviceDate = new Date(serviceDateStr + 'T00:00:00');
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - 7);
  return serviceDate >= cutoff && serviceDate <= now;
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Authentication required' } }, { status: 401 });
    if (user.role !== 'cell_leader') return NextResponse.json({ data: null, error: { message: 'Cell leaders only' } }, { status: 403 });

    const body = await req.json();
    const { service_id, entries, visitor_count, absence_reasons } = body;

    if (!service_id || !entries?.length) {
      return NextResponse.json({ data: null, error: { message: 'service_id and entries are required' } }, { status: 400 });
    }

    const cell_id = user.cell_id;
    if (!cell_id) return NextResponse.json({ data: null, error: { message: 'No cell assigned to your account' } }, { status: 400 });

    // ── Validate service is within 7-day window ─────────────────
    // Skip window check for virtual services (auto-created)
    if (!service_id.startsWith('virtual-')) {
      const svcRes = await fetch(
        `${SUPABASE_URL}/rest/v1/services?id=eq.${service_id}&select=id,service_date,service_type&limit=1`,
        { headers: hdrs() }
      );
      const svcData = await svcRes.json();
      const svc = svcData?.[0];
      if (!svc) return NextResponse.json({ data: null, error: { message: 'Service not found' } }, { status: 404 });
      if (!isWithinWindow(svc.service_date)) {
        return NextResponse.json({ data: null, error: { message: 'Submission window has closed for this service. Contact your administrator.' } }, { status: 403 });
      }
    }

    const present_count = entries.filter((e: Record<string, string>) => e.status === 'present').length;
    const absent_count = entries.filter((e: Record<string, string>) => e.status === 'absent').length;

    // ── SLA timestamp calculation ──────────────────────────────
    const now = new Date();
    const submittedAt = now.toISOString();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    let sla_grade = 'F';
    // Fetch service type for correct SLA window
    let serviceType = 'sunday';
    if (!service_id.startsWith('virtual-')) {
      const svcTypeRes = await fetch(
        `${SUPABASE_URL}/rest/v1/services?id=eq.${service_id}&select=service_type&limit=1`,
        { headers: hdrs() }
      );
      const svcTypeData = await svcTypeRes.json();
      serviceType = svcTypeData?.[0]?.service_type || 'sunday';
    }
    if (serviceType === 'midweek') {
      if (dayOfWeek === 3) { sla_grade = 'A+'; }
      else if (dayOfWeek === 4 && hour < 6) { sla_grade = 'A'; }
      else if (dayOfWeek === 4) { sla_grade = 'B'; }
      else if (dayOfWeek === 5) { sla_grade = 'C'; }
      else if (dayOfWeek === 6) { sla_grade = 'D'; }
      else if (dayOfWeek === 0) { sla_grade = 'F'; }
      else { sla_grade = 'F-'; }
    } else {
      if (dayOfWeek === 0) { sla_grade = 'A+'; }
      else if (dayOfWeek === 1 && hour < 6) { sla_grade = 'A'; }
      else if (dayOfWeek === 1) { sla_grade = 'B'; }
      else if (dayOfWeek === 2) { sla_grade = 'C'; }
      else if (dayOfWeek === 3) { sla_grade = 'D'; }
      else if (dayOfWeek === 4 || dayOfWeek === 5) { sla_grade = 'F'; }
      else { sla_grade = 'F-'; }
    }
    }

    // ── Check for duplicate submission ─────────────────────────
    let existingRecordId: string | null = null;
    if (!service_id.startsWith('virtual-')) {
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/attendance_records?service_id=eq.${service_id}&cell_id=eq.${cell_id}&select=id,is_locked&limit=1`,
        { headers: hdrs() }
      );
      const existing = await checkRes.json();
      if (existing?.[0]?.is_locked) {
        return NextResponse.json({ data: null, error: { message: 'Attendance locked by administrator' } }, { status: 409 });
      }
      if (existing?.[0]) {
        return NextResponse.json({ data: null, error: { message: 'Attendance already submitted for this service' } }, { status: 409 });
      }
    }

    // ── Handle virtual service — insert real service first ─────
    let realServiceId = service_id;
    if (service_id.startsWith('virtual-')) {
      const parts = service_id.replace('virtual-', '').split('-');
      const serviceNum = parts.pop();
      const serviceDate = parts.join('-');
      const insertSvcRes = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          service_date: serviceDate,
          service_number: parseInt(serviceNum || '1'),
          service_type: 'Sunday Service',
          notes: 'Auto-created on first submission',
        }),
      });
      const insertedSvc = await insertSvcRes.json();
      if (Array.isArray(insertedSvc) && insertedSvc[0]?.id) {
        realServiceId = insertedSvc[0].id;
      } else {
        // Service might already exist — fetch it
        const fetchSvcRes = await fetch(
          `${SUPABASE_URL}/rest/v1/services?service_date=eq.${serviceDate}&service_number=eq.${serviceNum}&select=id&limit=1`,
          { headers: hdrs() }
        );
        const fetchedSvc = await fetchSvcRes.json();
        if (fetchedSvc?.[0]?.id) {
          realServiceId = fetchedSvc[0].id;
        } else {
          return NextResponse.json({ data: null, error: { message: 'Could not create or find service record' } }, { status: 500 });
        }
      }
    }

    // ── Insert attendance record ────────────────────────────────
    const recRes = await fetch(`${SUPABASE_URL}/rest/v1/attendance_records`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        service_id: realServiceId,
        cell_id,
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
      console.error('Failed to insert attendance record:', recData);
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
      await fetch(`${SUPABASE_URL}/rest/v1/attendance_entries`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(entryRows),
      });
    }


    // ── Fire to all responsible parties ─────────────────────────
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://shepherd-app-beta.vercel.app'}/api/notify/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'shepherd-internal-2026' },
      body: JSON.stringify({
        event: 'attendance_submitted',
        actor_name: user.id,
        actor_role: user.role,
        cell_name: cell_id,
        fellowship_id: null,
        detail: `${present_count} present · ${absent_count} absent · SLA ${sla_grade}`,
      }),
    }).catch(() => {});
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

    let url = `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=200&select=id,service_id,cell_id,present_count,absent_count,visitor_count,submitted_at,sla_grade,services(service_date,service_number),cells(name)`;

    if (user.role === 'cell_leader' && user.cell_id) {
      url += `&cell_id=eq.${user.cell_id}`;
    }

    const res = await fetch(url, { headers: hdrs() });
    const data = await res.json();
    return NextResponse.json({ data: { records: Array.isArray(data) ? data : [] }, error: null });

  } catch (err) {
    console.error('[GET /api/attendance]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to fetch attendance' } }, { status: 500 });
  }
}
