import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

// ── Midweek absence alert engine
// ── Runs every Thursday after Wednesday service, once per church so one
// ── church's absentees never land in another's care queue.
// ── Soft alert after 2 missed midweek services — notifies cell leader only
// ── Full care lead after 3 missed midweek services — goes to care team
// ── Protected by secret key

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

function getLastWednesday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 3=Wed
  const daysBack = day >= 3 ? day - 3 : day + 4;
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split('T')[0];
}

function getPreviousWednesdays(count: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  const day = d.getDay();
  const daysBack = day >= 3 ? day - 3 : day + 4;
  d.setDate(d.getDate() - daysBack);
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() - 7);
  }
  return dates;
}

type ChurchResults = { church_id: string; soft_alerts: number; care_leads: number; skipped: number; errors: string[]; message?: string };

async function runForChurch(churchId: string): Promise<ChurchResults> {
  const results: ChurchResults = { church_id: churchId, soft_alerts: 0, care_leads: 0, skipped: 0, errors: [] };

  const lastThreeWednesdays = getPreviousWednesdays(3);
  const lastWednesday = getLastWednesday();

  const svcRes = await fetch(
    `${SUPABASE_URL}/rest/v1/services?service_date=in.(${lastThreeWednesdays.join(',')})&service_type=eq.midweek&church_id=eq.${churchId}&select=id,service_date`,
    { headers: hdrs() }
  );
  const services = await svcRes.json();
  if (!Array.isArray(services) || services.length === 0) {
    results.message = 'No midweek services found';
    return results;
  }

  const lastService = services.find((s: Record<string, string>) => s.service_date === lastWednesday);
  if (!lastService) {
    results.message = `No midweek service found for ${lastWednesday}`;
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
    return services.some((s: Record<string, string>) => s.id === rec?.service_id && s.service_date === lastWednesday);
  });

  if (lastWedAbsent.length === 0) {
    results.message = 'No absent members found for last Wednesday';
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

    if (memberAbsences < 2) {
      results.skipped++;
      continue;
    }

    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/care_leads?member_id=eq.${memberId}&status=in.(new,in_progress,reached,visited)&church_id=eq.${churchId}&select=id,weeks_absent&limit=1`,
      { headers: hdrs() }
    );
    const existing = await existingRes.json();

    if (memberAbsences === 2) {
      if (cellId) {
        const leaderRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?role=eq.cell_leader&cell_id=eq.${cellId}&church_id=eq.${churchId}&select=id&limit=1`,
          { headers: hdrs() }
        );
        const leaders = await leaderRes.json();
        if (leaders?.[0]) {
          await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
            method: 'POST',
            headers: { ...hdrs(), 'Prefer': 'return=minimal' },
            body: JSON.stringify([{
              user_id: leaders[0].id,
              type: 'pipeline',
              title: 'Midweek absence alert',
              body: `A member in your cell has missed 2 consecutive Wednesday services. Please follow up with them before this Sunday.`,
              read: false,
              church_id: churchId,
            }]),
          });
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
        notes: `Missed ${memberAbsences} consecutive Wednesday midweek services.`,
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
    const notifRows = careIds.map(userId => ({
      user_id: userId,
      type: 'pipeline',
      title: `${results.care_leads} midweek absence lead${results.care_leads > 1 ? 's' : ''} assigned`,
      body: `${results.care_leads} member${results.care_leads > 1 ? 's have' : ' has'} missed 3+ Wednesday services and been added to your queue.`,
      read: false,
      church_id: churchId,
    }));
    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(notifRows),
    });
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
      data: { last_wednesday: getLastWednesday(), ...totals, churches: perChurch },
      error: null,
    });
  } catch (err) {
    console.error('[POST /api/care/trigger-midweek-alerts]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to trigger midweek alerts' } }, { status: 500 });
  }
}

export async function GET(req: Request) {
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
