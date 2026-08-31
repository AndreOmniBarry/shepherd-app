import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { assignToLeastLoadedCareTeamMember } from '@/lib/care-assignment';
import { notifyUsers } from '@/lib/notify';

// ── This endpoint scans the church's last main-service attendance and
// ── creates care leads for any member who's missed enough CONSECUTIVE
// ── main services to cross their own church's configured threshold
// ── (church_config.absence_alert_threshold, default 1 — Settings →
// ── Services).
// ── Runs once per church so one church's absentees never land in
// ── another's care queue — see runForChurch() below.
// ── Runs automatically every day via Vercel Cron (see vercel.json); also
// ── reachable by a signed-in admin re-running it for their own church
// ── (GET, cookie-based) or any external scheduler (POST with a shared
// ── secret) — see isCronAuthorized()/GET below for exactly how each
// ── caller is told apart and protected.
// ── Was hardcoded to literal Sunday (getLastSunday()/getPreviousSundays()
// ── did real weekday-0 math, and the cron itself only ran Mondays) — a
// ── church whose "main" configured service day isn't Sunday (the
// ── Settings → Services picker lets an admin select days in any order,
// ── and church_config.service_days[0] — whichever was clicked first — is
// ── what /api/attendance treats as the primary/"sunday" service_type)
// ── would never have this fire on the right date. Same fix as the
// ── midweek cron: derive the church's own main day from
// ── church_config.service_days[0], and check "yesterday" against it
// ── daily instead of a fixed weekly schedule.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// The `count` occurrences of `dateStr`'s own weekday immediately before
// (and including) `dateStr`, oldest first — used to look back for a
// consecutive-absence streak when a church's threshold is above 1.
function getPreviousOccurrences(dateStr: string, count: number): string[] {
  const dates: string[] = [];
  const base = new Date(dateStr + 'T12:00:00');
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    dates.unshift(d.toISOString().split('T')[0]);
  }
  return dates;
}

type ChurchResults = { church_id: string; leads_created: number; leads_skipped: number; errors: string[]; message?: string };

async function runForChurch(churchId: string): Promise<ChurchResults> {
  const results: ChurchResults = { church_id: churchId, leads_created: 0, leads_skipped: 0, errors: [] };

  // Per-church configurable — see Settings → Services. Defaults to 1
  // (today's fixed behavior: escalate on the very first missed main
  // service).
  const configRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${churchId}&select=absence_alert_threshold,service_days&limit=1`, { headers: hdrs() });
  const configData = await configRes.json();
  const threshold: number = configData?.[0]?.absence_alert_threshold || 1;

  // First configured day is this church's "main" service (see
  // /api/attendance's identical convention — service_type='sunday' for
  // whichever day that is, regardless of its literal name).
  const serviceDays: string[] = configData?.[0]?.service_days?.length ? configData[0].service_days : ['Sunday'];
  const mainDay = serviceDays[0];

  const yesterday = getYesterday();
  const yesterdayName = DAY_NAMES[new Date(yesterday + 'T12:00:00').getDay()];
  if (yesterdayName !== mainDay) {
    results.message = `Yesterday (${yesterdayName}) isn't this church's configured main service day (${mainDay})`;
    return results;
  }
  const lastSunday = yesterday;

  // 1. Get yesterday's main service for this church
  const svcRes = await fetch(
    `${SUPABASE_URL}/rest/v1/services?service_date=eq.${lastSunday}&service_number=eq.1&church_id=eq.${churchId}&select=id&limit=1`,
    { headers: hdrs() }
  );
  const svcData = await svcRes.json();
  const service = svcData?.[0];
  if (!service) {
    results.message = `No service found for ${lastSunday}`;
    return results;
  }

  // 2. Get all attendance entries marked absent for this service — already
  // church-scoped via service_id, since that service belongs to this church.
  const recordIdsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/attendance_records?service_id=eq.${service.id}&select=id`,
    { headers: hdrs() }
  );
  const recordIdsData = await recordIdsRes.json();
  const recordIds: string[] = Array.isArray(recordIdsData) ? recordIdsData.map((r: Record<string, string>) => r.id) : [];

  const absentEntries = recordIds.length > 0 ? await (async () => {
    const absentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_entries?status=eq.absent&record_id=in.(${recordIds.join(',')})&select=member_id,absence_reason`,
      { headers: hdrs() }
    );
    return absentRes.json();
  })() : [];

  if (!Array.isArray(absentEntries) || absentEntries.length === 0) {
    results.message = `No absent members found for ${lastSunday}`;
    return results;
  }

  // Look up each absent member's branch so the resulting care lead carries
  // it too — otherwise a branch's absentees would leak into every branch's
  // care queue.
  const memberIds = [...new Set(absentEntries.map((e: Record<string, string>) => e.member_id).filter(Boolean))];
  const membersRes = memberIds.length > 0 ? await fetch(
    `${SUPABASE_URL}/rest/v1/members?id=in.(${memberIds.join(',')})&church_id=eq.${churchId}&select=id,branch_id`,
    { headers: hdrs() }
  ) : null;
  const membersData = membersRes ? await membersRes.json() : [];
  const branchByMember: Record<string, string | null> = {};
  if (Array.isArray(membersData)) {
    membersData.forEach((m: Record<string, string>) => { branchByMember[m.id] = m.branch_id || null; });
  }

  const careIdsRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.care_team&church_id=eq.${churchId}&select=id`, { headers: hdrs() });
  const careIdsData = await careIdsRes.json();
  const careIds: string[] = Array.isArray(careIdsData) ? careIdsData.map((u: Record<string, string>) => u.id) : [];

  // When the threshold is above 1, a member has to be marked absent on
  // EVERY one of the previous (threshold - 1) Sundays too, not just this
  // one — a single missed week alone must never escalate. Fetches each
  // prior Sunday's main service + its absent entries once per church
  // (not once per member), building memberId -> set of dates confirmed
  // absent on.
  const priorAbsentByMember: Record<string, Set<string>> = {};
  let priorSundays: string[] = [];
  if (threshold > 1) {
    // The (threshold - 1) occurrences of the main day strictly before lastSunday.
    priorSundays = getPreviousOccurrences(lastSunday, threshold).slice(0, -1);
    const priorSvcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=in.(${priorSundays.join(',')})&service_number=eq.1&church_id=eq.${churchId}&select=id,service_date`,
      { headers: hdrs() }
    );
    const priorSvcData = await priorSvcRes.json();
    const priorServices: { id: string; service_date: string }[] = Array.isArray(priorSvcData) ? priorSvcData : [];
    if (priorServices.length > 0) {
      const dateByRecordId: Record<string, string> = {};
      const priorRecordIdsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/attendance_records?service_id=in.(${priorServices.map(s => s.id).join(',')})&select=id,service_id`,
        { headers: hdrs() }
      );
      const priorRecordIdsData = await priorRecordIdsRes.json();
      const priorRecordIds: { id: string; service_id: string }[] = Array.isArray(priorRecordIdsData) ? priorRecordIdsData : [];
      const serviceDateById: Record<string, string> = {};
      priorServices.forEach(s => { serviceDateById[s.id] = s.service_date; });
      priorRecordIds.forEach(r => { dateByRecordId[r.id] = serviceDateById[r.service_id]; });

      if (priorRecordIds.length > 0) {
        const priorAbsentRes = await fetch(
          `${SUPABASE_URL}/rest/v1/attendance_entries?status=eq.absent&record_id=in.(${priorRecordIds.map(r => r.id).join(',')})&select=member_id,record_id`,
          { headers: hdrs() }
        );
        const priorAbsentData = await priorAbsentRes.json();
        (Array.isArray(priorAbsentData) ? priorAbsentData : []).forEach((e: Record<string, string>) => {
          const date = dateByRecordId[e.record_id];
          if (!e.member_id || !date) return;
          (priorAbsentByMember[e.member_id] = priorAbsentByMember[e.member_id] || new Set()).add(date);
        });
      }
    }
  }

  // 4. For each absent member — create care lead if none exists
  for (let i = 0; i < absentEntries.length; i++) {
    const entry = absentEntries[i] as Record<string, string>;
    const memberId = entry.member_id;
    if (!memberId) continue;

    // Check if open lead already exists (church-scoped)
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/care_leads?member_id=eq.${memberId}&status=in.(new,in_progress,reached,visited)&church_id=eq.${churchId}&select=id,weeks_absent&limit=1`,
      { headers: hdrs() }
    );
    const existing = await existingRes.json();

    if (existing?.[0]) {
      // Lead exists — increment weeks_absent
      await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${existing[0].id}&church_id=eq.${churchId}`, {
        method: 'PATCH',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ weeks_absent: existing[0].weeks_absent + 1, updated_at: new Date().toISOString() }),
      });
      results.leads_skipped++;
      continue;
    }

    // Below threshold — confirmed absent this week, but hasn't yet missed
    // enough CONSECUTIVE prior Sundays to escalate. No lead, no
    // notification; the next weekly run checks again.
    if (threshold > 1) {
      const confirmedDates = priorAbsentByMember[memberId];
      const metStreak = priorSundays.every(d => confirmedDates?.has(d));
      if (!metStreak) {
        results.leads_skipped++;
        continue;
      }
    }

    // Assign to whichever care team member (within this church) currently
    // has the fewest open items
    const assignedTo = await assignToLeastLoadedCareTeamMember(SUPABASE_URL, hdrs(), churchId);

    // Create new care lead
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/care_leads`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        member_id: memberId,
        assigned_to: assignedTo,
        weeks_absent: threshold,
        status: 'new',
        contact_attempts: 0,
        notes: entry.absence_reason ? `Absence reason logged: ${entry.absence_reason}` : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        branch_id: branchByMember[memberId] || null,
        church_id: churchId,
      }),
    });

    if (insertRes.ok) {
      results.leads_created++;
    } else {
      const err = await insertRes.text();
      results.errors.push(`Member ${memberId}: ${err}`);
    }
  }

  // 5. Send notification to this church's care team members
  if (results.leads_created > 0 && careIds.length > 0) {
    await notifyUsers(careIds, {
      type: 'pipeline',
      title: `${results.leads_created} new absence lead${results.leads_created > 1 ? 's' : ''} assigned`,
      body: threshold > 1
        ? `${results.leads_created} member${results.leads_created > 1 ? 's have' : ' has'} missed ${threshold} main services in a row and ${results.leads_created > 1 ? 'were' : 'was'} assigned to your queue. Please follow up before the next service.`
        : `${results.leads_created} member${results.leads_created > 1 ? 's were' : ' was'} absent from your last main service and assigned to your queue. Please follow up before the next service.`,
    }, churchId);
  }

  return results;
}

export async function POST(req: Request) {
  try {
    // Simple secret key protection
    const body = await req.json().catch(() => ({}));
    const secret = body.secret || req.headers.get('x-cron-secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If a specific church_id is passed (the manual per-church trigger from
    // the dashboard does this), only run that one. Otherwise run every
    // church — each fully isolated from the others.
    let churchIds: string[];
    if (body.church_id) {
      churchIds = [body.church_id];
    } else {
      const churchesRes = await fetch(`${SUPABASE_URL}/rest/v1/churches?select=id`, { headers: hdrs() });
      const churchesData = await churchesRes.json();
      churchIds = Array.isArray(churchesData) ? churchesData.map((c: { id: string }) => c.id) : [];
    }

    const perChurch: ChurchResults[] = [];
    for (const churchId of churchIds) {
      perChurch.push(await runForChurch(churchId));
    }

    const totals = perChurch.reduce((acc, r) => ({
      leads_created: acc.leads_created + r.leads_created,
      leads_skipped: acc.leads_skipped + r.leads_skipped,
    }), { leads_created: 0, leads_skipped: 0 });

    return NextResponse.json({
      data: { checked_date: getYesterday(), ...totals, churches: perChurch },
      error: null,
    });

  } catch (err) {
    console.error('[POST /api/care/trigger-alerts]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to trigger alerts' } }, { status: 500 });
  }
}

// GET has two distinct callers, told apart by how they authenticate:
//   1. Vercel Cron (see vercel.json) — every day, no cookie, no
//      church_id. Vercel automatically sends `Authorization: Bearer
//      $CRON_SECRET` when that env var is set (same convention as
//      /api/admin/health-check) — sweeps every church.
//   2. A signed-in admin manually re-running it for their own church —
//      scoped to their own church_id only; they should never be able to
//      sweep every other church too.
function isCronAuthorized(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.headers.get('x-cron-secret') === process.env.CRON_SECRET) return true;
  return false;
}

export async function GET(req: Request) {
  try {
    if (isCronAuthorized(req)) {
      const postReq = new Request(req.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: process.env.CRON_SECRET }),
      });
      return POST(postReq);
    }

    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    if (!m?.[1]) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(m[1]);
    const user = payload ? payloadToAuthUser(payload) : null;
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const postReq = new Request(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookie },
      body: JSON.stringify({ secret: process.env.CRON_SECRET, church_id: user.church_id }),
    });
    return POST(postReq);
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 });
  }
}
