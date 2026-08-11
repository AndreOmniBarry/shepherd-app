import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { notifyUsers } from '@/lib/notify';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function isWithinWindow(serviceDateStr: string): boolean {
  const serviceDate = new Date(serviceDateStr + 'T00:00:00');
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - 14);
  return serviceDate >= cutoff && serviceDate <= now;
}

function calcSLA(submittedAt: Date): string {
  const day = submittedAt.getDay();
  const hour = submittedAt.getHours();
  if (day === 0) return 'A+';
  if (day === 1 && hour < 6) return 'A';
  if (day === 1) return 'B';
  if (day === 2) return 'C';
  if (day === 3) return 'D';
  if (day === 4 || day === 5) return 'F';
  return 'F-';
}

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

// No hardcoded fellowship — this feature applies to whichever fellowship a
// church has flagged as "aggregate only" (fellowships.is_aggregate_only).
// Comforters House uses it for a combined Children & Teenagers fellowship,
// but the flag itself is generic: any church can mark any fellowship this
// way if it doesn't track individual members/cells, just a headcount.
async function getAggregateFellowship(fellowshipId: string | null, churchId: string | null | undefined) {
  if (!fellowshipId) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/fellowships?id=eq.${fellowshipId}&is_aggregate_only=eq.true&church_id=eq.${churchId}&select=id,name`, { headers: hdrs() });
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const fellowship = await getAggregateFellowship(user.fellowship_id, user.church_id);
    if (!fellowship) return NextResponse.json({ data: null, error: { message: 'Not an aggregate-only fellowship' } }, { status: 403 });

    // Get last 8 weeks of headcounts
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 56);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cydf_headcount?fellowship_id=eq.${fellowship.id}&submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=12&select=id,children_count,teenagers_count,submitted_at,sla_grade,notes,services(service_date)`,
      { headers: hdrs() }
    );
    const data = await res.json();

    return NextResponse.json({
      data: {
        history: Array.isArray(data) ? data : [],
        fellowship_name: fellowship.name,
      },
      error: null,
    });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const fellowship = await getAggregateFellowship(user.fellowship_id, user.church_id);
    if (!fellowship) return NextResponse.json({ data: null, error: { message: 'Not an aggregate-only fellowship' } }, { status: 403 });

    const body = await req.json();
    const { service_date, children_count, teenagers_count, notes } = body;
    const service_number = Math.max(1, Math.min(10, Number(body.service_number) || 1));

    if (!service_date) return NextResponse.json({ data: null, error: { message: 'Service date is required' } }, { status: 400 });
    if (!isWithinWindow(service_date)) {
      return NextResponse.json({ data: null, error: { message: 'That date is outside the submission window. Contact your administrator.' } }, { status: 403 });
    }

    // Reuse an existing services row for this exact date if one already
    // exists (a regular day or an admin-sanctioned special day) — only
    // cross-checks the day-of-week against the church's configured service
    // days when creating a brand new row, same rule cell/department
    // attendance follow, so a sanctioned special day never gets blocked.
    const existingSvcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=eq.${service_date}&service_number=eq.${service_number}&church_id=eq.${user.church_id}&select=id`,
      { headers: hdrs() }
    );
    const existingSvc = await existingSvcRes.json();
    let service_id: string | null = existingSvc?.[0]?.id || null;

    if (!service_id) {
      const [y, mo, d] = service_date.split('-').map(Number);
      const dateObj = new Date(y, mo - 1, d);
      const dayName = DAY_NAMES[dateObj.getDay()];

      let serviceDays: string[] = ['Sunday'];
      if (user.branch_id) {
        const branchRes = await fetch(`${SUPABASE_URL}/rest/v1/branches?id=eq.${user.branch_id}&select=service_days&limit=1`, { headers: hdrs() });
        const branchData = await branchRes.json();
        if (branchData?.[0]?.service_days?.length) serviceDays = branchData[0].service_days;
      } else {
        const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${user.church_id}&select=service_days&limit=1`, { headers: hdrs() });
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
      service_id = Array.isArray(insertedSvc) && insertedSvc[0]?.id ? insertedSvc[0].id : null;
      if (!service_id) {
        const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/services?service_date=eq.${service_date}&service_number=eq.${service_number}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: hdrs() });
        const retryData = await retryRes.json();
        service_id = retryData?.[0]?.id || null;
      }
      if (!service_id) return NextResponse.json({ data: null, error: { message: 'Could not create or find service record' } }, { status: 500 });
    }

    const submittedAt = new Date();
    const sla_grade = calcSLA(submittedAt);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/cydf_headcount`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        service_id,
        fellowship_id: fellowship.id,
        children_count: parseInt(children_count) || 0,
        teenagers_count: parseInt(teenagers_count) || 0,
        submitted_by: user.id,
        sla_grade,
        notes: notes || null,
        submitted_at: submittedAt.toISOString(),
      }),
    });
    const data = await res.json();

    // This comment used to say "Notify pastor and PA" while only ever
    // notifying the submitter — the lookup was never actually implemented.
    // Now does both: the submitter gets their own confirmation, and
    // overseer/general_overseer/pa (this church's "pastor and PA") get
    // real visibility into the submission, scoped to this church only —
    // same church_id-scoped admin-lookup pattern already used correctly
    // in events/checkin.
    const adminRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=in.(overseer,general_overseer,pa)&church_id=eq.${user.church_id}&select=id`,
      { headers: hdrs() }
    );
    const admins = await adminRes.json();
    const adminIds = Array.isArray(admins) ? admins.map((u: { id: string }) => u.id) : [];
    const recipients = Array.from(new Set([user.id, ...adminIds]));

    await notifyUsers(recipients, {
      type: 'attendance',
      title: 'CYDF attendance submitted',
      body: `Children: ${children_count || 0} · Teenagers: ${teenagers_count || 0} · SLA: ${sla_grade}`,
    }, user.church_id);

    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to submit' } }, { status: 500 });
  }
}
