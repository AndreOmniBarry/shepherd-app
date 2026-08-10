import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { computeSlaGrade } from '@/lib/sla';
import { resolveBranchScope } from '@/lib/branch-scope';

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

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Authentication required' } }, { status: 401 });

    const body = await req.json();

    if (user.role !== 'cell_leader') {
      // Narrow, explicit exception, additive on top of the existing
      // cell_leader-only check above (which is unchanged for everyone
      // else): a `single`-structure church ("one congregation, one
      // pastor, no sub-structure needed") has no cell_leader at all —
      // its one auto-provisioned cell (see bootstrapChurch in
      // /api/settings/church-config) is meant to be submitted for by
      // its admin roles instead. Every other role/structure combination
      // still hits the 403 below exactly as before.
      const ADMIN_ROLES = ['overseer', 'general_overseer', 'pa', 'lead_tech'];
      let allowed = false;
      if (ADMIN_ROLES.includes(user.role) && user.church_id && body.cell_id) {
        const cfgRes = await fetch(
          `${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${user.church_id}&select=structure_type&limit=1`,
          { headers: hdrs() }
        );
        const cfgData = await cfgRes.json();
        const structureType = cfgData?.[0]?.structure_type;
        if (structureType === 'single') {
          // Re-validate the client-supplied cell_id belongs to this same
          // church before allowing it through — never trust it alone
          // (see MULTI_TENANT_AUDIT.md's canonical pattern for
          // client-supplied ids). This is what stops an admin of one
          // single-structure church from submitting for a cell in a
          // *different* single-structure church.
          const cellCheckRes = await fetch(
            `${SUPABASE_URL}/rest/v1/cells?id=eq.${body.cell_id}&church_id=eq.${user.church_id}&select=id&limit=1`,
            { headers: hdrs() }
          );
          const cellCheckData = await cellCheckRes.json();
          allowed = !!cellCheckData?.[0]?.id;
        }
      }
      if (!allowed) {
        return NextResponse.json({ data: null, error: { message: 'Cell leaders only' } }, { status: 403 });
      }
    }

    const { service_date, entries, visitor_count, absence_reasons } = body;
    const service_number = Math.max(1, Math.min(10, Number(body.service_number) || 1));

    if (!service_date || !entries?.length) {
      return NextResponse.json({ data: null, error: { message: 'service_date and entries are required' } }, { status: 400 });
    }

    // cell_leader submits implicitly for their own assigned cell, exactly
    // as before. The newly-allowed admin-role/single-structure-church
    // path above already re-validated body.cell_id against this church,
    // so it's safe to accept it from the body only for that narrow case.
    const cell_id = user.role === 'cell_leader' ? user.cell_id : (body.cell_id || user.cell_id);
    if (!cell_id) return NextResponse.json({ data: null, error: { message: 'No cell assigned to your account' } }, { status: 400 });

    if (!isWithinWindow(service_date)) {
      return NextResponse.json({ data: null, error: { message: 'That date is outside the submission window. Contact your administrator.' } }, { status: 403 });
    }

    // Find or create the services row for this exact date and service
    // number — one and only one place this ever happens, so service_type
    // can never drift from the date's actual day-of-week. If an admin
    // already sanctioned this exact date (a regular Sunday/midweek OR a
    // special day like a vigil or convention, created via Service
    // Planner's Special Service Days), reuse it as-is and skip the
    // day-of-week check below entirely — that check only exists to stop
    // backdating attendance to an arbitrary, never-sanctioned day, not to
    // block legitimate special-day services.
    const existingSvcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=eq.${service_date}&service_number=eq.${service_number}&church_id=eq.${user.church_id}&select=id&limit=1`,
      { headers: hdrs() }
    );
    const existingSvc = await existingSvcRes.json();
    let realServiceId: string | null = existingSvc?.[0]?.id || null;

    if (!realServiceId) {
      // Server derives the real day-of-week and cross-checks against the
      // church's own configured service days — never trusts a client-sent
      // label, and doesn't care which specific weekdays the church picked.
      const [y, mo, d] = service_date.split('-').map(Number);
      const dateObj = new Date(y, mo - 1, d);
      const dayName = DAY_NAMES[dateObj.getDay()];

      // Branch's own configured service days take priority over the
      // church-wide default — a branch whose primary day isn't Sunday
      // (e.g. Saturday/Tuesday) is no longer mislabeled as "midweek".
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
      // First configured day is the "primary" service (labeled sunday for
      // backward compatibility); every other configured day is "midweek".
      const service_type = dayName === serviceDays[0] ? 'sunday' : 'midweek';

      const insertSvcRes = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
        method: 'POST', headers: { ...hdrs(), 'Prefer': 'return=representation' },
        body: JSON.stringify({ service_date, service_number, service_type, notes: 'Auto-created on first submission', church_id: user.church_id || null }),
      });
      const insertedSvc = await insertSvcRes.json();
      realServiceId = Array.isArray(insertedSvc) && insertedSvc[0]?.id ? insertedSvc[0].id : null;
      if (!realServiceId) {
        // Race with another submission creating it first — fetch again.
        const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/services?service_date=eq.${service_date}&service_number=eq.${service_number}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: hdrs() });
        const retryData = await retryRes.json();
        realServiceId = retryData?.[0]?.id || null;
      }
      if (!realServiceId) return NextResponse.json({ data: null, error: { message: 'Could not create or find service record' } }, { status: 500 });
    }

    // ── Check for duplicate submission ─────────────────────────
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?service_id=eq.${realServiceId}&cell_id=eq.${cell_id}&select=id,is_locked&limit=1`,
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
    // Universal, day-independent — how long after the actual service date
    // this got logged, not a lookup table tied to specific weekdays.
    const sla_grade = computeSlaGrade(`${service_date}T00:00:00`, submittedAt);

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
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_SECRET || '' },
      body: JSON.stringify({
        event: 'attendance_submitted',
        actor_name: user.id,
        actor_role: user.role,
        church_id: user.church_id,
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
    } else {
      // attendance_records carries no church_id of its own, so it's always
      // scoped via the cells that belong to this caller's church (and,
      // optionally, a specific branch within it) — otherwise an admin
      // dashboard with no branch_id given would leak every church's
      // attendance records.
      const { searchParams: sp2 } = new URL(req.url);
      const { branchId, forbidden } = resolveBranchScope(user, sp2);
      if (forbidden) {
        return NextResponse.json({ data: { records: [] }, error: null });
      }
      let cellsUrl = `${SUPABASE_URL}/rest/v1/cells?church_id=eq.${user.church_id}&select=id`;
      if (branchId) cellsUrl += `&branch_id=eq.${branchId}`;
      const cellsRes = await fetch(cellsUrl, { headers: hdrs() });
      const cellRows: { id: string }[] = await cellsRes.json();
      const cellIds = (Array.isArray(cellRows) ? cellRows : []).map(c => c.id);
      url += cellIds.length > 0 ? `&cell_id=in.(${cellIds.join(',')})` : '&cell_id=eq.00000000-0000-0000-0000-000000000000';
    }

    const res = await fetch(url, { headers: hdrs() });
    const data = await res.json();
    return NextResponse.json({ data: { records: Array.isArray(data) ? data : [] }, error: null });

  } catch (err) {
    console.error('[GET /api/attendance]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to fetch attendance' } }, { status: 500 });
  }
}
