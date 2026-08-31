import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { notifyUsers } from '@/lib/notify';

// ── Midweek absence alert engine
// ── Runs automatically every day via Vercel Cron (see vercel.json), once
// ── per church so one church's absentees never land in another's care
// ── queue. Was hardcoded to literal Wednesday — a church whose midweek
// ── service actually falls on Thursday, Friday, or any other day never
// ── had this fire at all (its real service_type='midweek' rows just
// ── never matched a hardcoded "last Wednesday" date). Now derives each
// ── church's own midweek day(s) from church_config.service_days — every
// ── configured day after the first (the first is that church's "main"
// ── day, matching the exact convention /api/attendance uses to decide
// ── service_type='sunday' vs 'midweek' when a service is first created)
// ── — and only does any work on the one day a year — er, week — that's
// ── actually the day after one of them. Every other day, every other
// ── church, is a fast no-op.
// ── Soft alert after church_config.midweek_soft_alert_threshold missed
// ── midweek services (default 2) — notifies cell leader only.
// ── Full care lead after church_config.midweek_care_lead_threshold
// ── (default 3) — goes to the care team. Settings → Services.
// ── Known limitation: this reads the church-wide service_days default
// ── only, not a branch's own override (branches.service_days) — a branch
// ── running its midweek service on a different day than the church
// ── default won't get its own alert timed correctly. Same scope the
// ── church-wide absence cron (trigger-alerts) already had.
// ── Auth: see isCronAuthorized()/GET below — same convention as
// ── /api/care/trigger-alerts.

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

// The `count` occurrences of `dateStr`'s own weekday, walking back 7 days
// at a time, oldest first (including dateStr itself) — used to look back
// for a consecutive-absence streak when a church's threshold is above 1.
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

type ChurchResults = { church_id: string; soft_alerts: number; care_leads: number; skipped: number; errors: string[]; message?: string };

async function runForChurch(churchId: string): Promise<ChurchResults> {
  const results: ChurchResults = { church_id: churchId, soft_alerts: 0, care_leads: 0, skipped: 0, errors: [] };

  // Per-church configurable — see Settings → Services. Defaults (2/3)
  // match today's fixed behavior for any church that never touches them.
  const configRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${churchId}&select=midweek_soft_alert_threshold,midweek_care_lead_threshold,service_days&limit=1`, { headers: hdrs() });
  const configData = await configRes.json();
  const softThreshold: number = configData?.[0]?.midweek_soft_alert_threshold || 2;
  const fullThreshold: number = configData?.[0]?.midweek_care_lead_threshold || 3;
  const lookbackWeeks = Math.max(softThreshold, fullThreshold);

  // First configured day is this church's "main" service (see
  // /api/attendance's identical convention) — every other configured day
  // is a midweek day. A church that only ever configured one day (or
  // none) has no midweek service at all; nothing to check.
  const serviceDays: string[] = configData?.[0]?.service_days?.length ? configData[0].service_days : ['Sunday'];
  const midweekDays = serviceDays.slice(1);
  if (midweekDays.length === 0) {
    results.message = 'No midweek service day configured for this church';
    return results;
  }

  const yesterday = getYesterday();
  const yesterdayName = DAY_NAMES[new Date(yesterday + 'T12:00:00').getDay()];
  if (!midweekDays.includes(yesterdayName)) {
    results.message = `Yesterday (${yesterdayName}) isn't one of this church's configured midweek days (${midweekDays.join(', ')})`;
    return results;
  }

  const lastMidweekDate = yesterday;
  const lookbackDates = getPreviousOccurrences(yesterday, lookbackWeeks);

  const svcRes = await fetch(
    `${SUPABASE_URL}/rest/v1/services?service_date=in.(${lookbackDates.join(',')})&service_type=eq.midweek&church_id=eq.${churchId}&select=id,service_date`,
    { headers: hdrs() }
  );
  const services = await svcRes.json();
  if (!Array.isArray(services) || services.length === 0) {
    results.message = 'No midweek services found';
    return results;
  }

  const lastService = services.find((s: Record<string, string>) => s.service_date === lastMidweekDate);
  if (!lastService) {
    results.message = `No midweek service found for ${lastMidweekDate}`;
    return results;
  }

  const serviceIds = services.map((s: { id: string }) => s.id);

  // Attendance entries are joined through this church's own service ids —
  // already correctly scoped since attendance_records/entries have no
  // church_id column of their own.
  const attRes = await fetch(
    `${SUPABASE_URL}/rest/v1/attendance_entries?status=eq.absent&select=member_id,record_id,attendance_records(service_id,cell_id)`,
    { headers: hdrs() }
  );
  const allEntriesRaw = await attRes.json();
  const allEntries = Array.isArray(allEntriesRaw)
    ? allEntriesRaw.filter((e: Record<string, unknown>) => {
        const rec = e.attendance_records as Record<string, string> | null;
        return rec?.service_id && serviceIds.includes(rec.service_id);
      })
    : [];

  const lastWedAbsent = allEntries.filter((e: Record<string, unknown>) => {
    const rec = e.attendance_records as Record<string, string> | null;
    return services.some((s: Record<string, string>) => s.id === rec?.service_id && s.service_date === lastMidweekDate);
  });

  if (lastWedAbsent.length === 0) {
    results.message = `No absent members found for ${lastMidweekDate}`;
    return results;
  }

  const careRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?role=eq.care_team&is_active=eq.true&church_id=eq.${churchId}&select=id`,
    { headers: hdrs() }
  );
  const careTeam = await careRes.json();
  const careIds: string[] = Array.isArray(careTeam) ? careTeam.map((u: Record<string, string>) => u.id) : [];

  const midweekMemberIds = [...new Set(lastWedAbsent.map((e: Record<string, unknown>) => e.member_id as string).filter(Boolean))];
  const midweekMembersRes = midweekMemberIds.length > 0 ? await fetch(
    `${SUPABASE_URL}/rest/v1/members?id=in.(${midweekMemberIds.join(',')})&church_id=eq.${churchId}&select=id,branch_id`,
    { headers: hdrs() }
  ) : null;
  const midweekMembersData = midweekMembersRes ? await midweekMembersRes.json() : [];
  const midweekBranchByMember: Record<string, string | null> = {};
  if (Array.isArray(midweekMembersData)) {
    midweekMembersData.forEach((m: Record<string, string>) => { midweekBranchByMember[m.id] = m.branch_id || null; });
  }

  const processedMembers = new Set<string>();

  for (let i = 0; i < lastWedAbsent.length; i++) {
    const entry = lastWedAbsent[i] as Record<string, unknown>;
    const memberId = entry.member_id as string;
    const rec = entry.attendance_records as Record<string, string> | null;
    const cellId = rec?.cell_id;

    if (!memberId || processedMembers.has(memberId)) continue;
    processedMembers.add(memberId);

    const memberAbsences = allEntries.filter((e: Record<string, unknown>) => e.member_id === memberId && e.status === 'absent').length;

    if (memberAbsences < softThreshold) {
      results.skipped++;
      continue;
    }

    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/care_leads?member_id=eq.${memberId}&status=in.(new,in_progress,reached,visited)&church_id=eq.${churchId}&select=id,weeks_absent&limit=1`,
      { headers: hdrs() }
    );
    const existing = await existingRes.json();

    if (memberAbsences < fullThreshold) {
      if (cellId) {
        const leaderRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?role=eq.cell_leader&cell_id=eq.${cellId}&church_id=eq.${churchId}&select=id&limit=1`,
          { headers: hdrs() }
        );
        const leaders = await leaderRes.json();
        if (leaders?.[0]) {
          await notifyUsers([leaders[0].id], {
            type: 'pipeline',
            title: 'Midweek absence alert',
            body: `A member in your cell has missed ${memberAbsences} consecutive midweek services. Please follow up with them before the next service.`,
          }, churchId);
        }
      }
      results.soft_alerts++;
      continue;
    }

    if (existing?.[0]) {
      await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${existing[0].id}&church_id=eq.${churchId}`, {
        method: 'PATCH',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          weeks_absent: (existing[0].weeks_absent || 0) + 1,
          updated_at: new Date().toISOString(),
        }),
      });
      results.skipped++;
      continue;
    }

    const assignedTo = careIds.length > 0 ? careIds[i % careIds.length] : null;
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/care_leads`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        member_id: memberId,
        assigned_to: assignedTo,
        weeks_absent: memberAbsences,
        status: 'new',
        contact_attempts: 0,
        notes: `Missed ${memberAbsences} consecutive midweek services.`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        branch_id: midweekBranchByMember[memberId] || null,
        church_id: churchId,
      }),
    });

    if (insertRes.ok) {
      results.care_leads++;
    } else {
      results.errors.push(`Member ${memberId}: failed to create lead`);
    }
  }

  if (results.care_leads > 0 && careIds.length > 0) {
    await notifyUsers(careIds, {
      type: 'pipeline',
      title: `${results.care_leads} midweek absence lead${results.care_leads > 1 ? 's' : ''} assigned`,
      body: `${results.care_leads} member${results.care_leads > 1 ? 's have' : ' has'} missed ${fullThreshold}+ midweek services and been added to your queue.`,
    }, churchId);
  }

  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = body.secret || req.headers.get('x-cron-secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      soft_alerts: acc.soft_alerts + r.soft_alerts,
      care_leads: acc.care_leads + r.care_leads,
      skipped: acc.skipped + r.skipped,
    }), { soft_alerts: 0, care_leads: 0, skipped: 0 });

    return NextResponse.json({
      data: { checked_date: getYesterday(), ...totals, churches: perChurch },
      error: null,
    });
  } catch (err) {
    console.error('[POST /api/care/trigger-midweek-alerts]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to trigger midweek alerts' } }, { status: 500 });
  }
}

// Same two-caller split as /api/care/trigger-alerts: Vercel Cron
// (Authorization: Bearer $CRON_SECRET, sweeps every church) vs. a
// signed-in admin manually re-running it for their own church only.
function isCronAuthorized(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.headers.get('x-cron-secret') === process.env.CRON_SECRET) return true;
  return false;
}

export async function GET(req: Request) {
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
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ secret: process.env.CRON_SECRET, church_id: user.church_id }),
  });
  return POST(postReq);
}
