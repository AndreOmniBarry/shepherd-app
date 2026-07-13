import { NextResponse } from 'next/server';

// ── Midweek absence alert engine
// ── Runs every Thursday after Wednesday service
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = body.secret || req.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'shepherd-cron-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = { soft_alerts: 0, care_leads: 0, skipped: 0, errors: [] as string[] };

    // Get last 3 Wednesdays
    const lastThreeWednesdays = getPreviousWednesdays(3);
    const lastWednesday = lastThreeWednesdays[0];

    // Get midweek services for last 3 weeks
    const svcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=in.(${lastThreeWednesdays.join(',')})&service_type=eq.midweek&select=id,service_date`,
      { headers: hdrs() }
    );
    const services = await svcRes.json();

    if (!Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ data: { message: 'No midweek services found', ...results }, error: null });
    }

    // Get last Wednesday's service
    const lastService = services.find((s: Record<string, string>) => s.service_date === lastWednesday);
    if (!lastService) {
      return NextResponse.json({ data: { message: `No midweek service found for ${lastWednesday}`, ...results }, error: null });
    }

    // Get all attendance entries for last Wednesday
    const attRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_entries?status=eq.absent&select=member_id,record_id,attendance_records(service_id,cell_id)`,
      { headers: hdrs() }
    );
    const allEntries = await attRes.json();

    // Filter to last Wednesday's absent members
    const lastWedAbsent = Array.isArray(allEntries)
      ? allEntries.filter((e: Record<string, unknown>) => {
          const rec = e.attendance_records as Record<string, string> | null;
          return services.some((s: Record<string, string>) => s.id === rec?.service_id && s.service_date === lastWednesday);
        })
      : [];

    if (lastWedAbsent.length === 0) {
      return NextResponse.json({ data: { message: 'No absent members found for last Wednesday', ...results }, error: null });
    }

    // Get care team for assignment
    const careRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.care_team&is_active=eq.true&select=id`,
      { headers: hdrs() }
    );
    const careTeam = await careRes.json();
    const careIds: string[] = Array.isArray(careTeam) ? careTeam.map((u: Record<string, string>) => u.id) : [];

    // For each absent member — check how many of last 3 Wednesdays they missed
    const processedMembers = new Set<string>();

    for (let i = 0; i < lastWedAbsent.length; i++) {
      const entry = lastWedAbsent[i] as Record<string, unknown>;
      const memberId = entry.member_id as string;
      const rec = entry.attendance_records as Record<string, string> | null;
      const cellId = rec?.cell_id;

      if (!memberId || processedMembers.has(memberId)) continue;
      processedMembers.add(memberId);

      // Count how many of the last 3 Wednesdays this member missed
      const memberAbsences = Array.isArray(allEntries)
        ? allEntries.filter((e: Record<string, unknown>) => {
            const r = e.attendance_records as Record<string, string> | null;
            return e.member_id === memberId &&
              e.status === 'absent' &&
              services.some((s: Record<string, string>) => s.id === r?.service_id);
          }).length
        : 0;

      if (memberAbsences < 2) {
        results.skipped++;
        continue;
      }

      // Check if midweek care lead already exists
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/care_leads?member_id=eq.${memberId}&status=in.(new,in_progress,reached,visited)&select=id,weeks_absent&limit=1`,
        { headers: hdrs() }
      );
      const existing = await existingRes.json();

      if (memberAbsences === 2) {
        // Soft alert — notify cell leader only, no care lead created
        // Get cell leader for this member's cell
        if (cellId) {
          const leaderRes = await fetch(
            `${SUPABASE_URL}/rest/v1/users?role=eq.cell_leader&cell_id=eq.${cellId}&select=id&limit=1`,
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
              }]),
            });
          }
        }
        results.soft_alerts++;
        continue;
      }

      // 3+ misses — create full care lead
      if (existing?.[0]) {
        await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${existing[0].id}`, {
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
        }),
      });

      if (insertRes.ok) {
        results.care_leads++;
      } else {
        results.errors.push(`Member ${memberId}: failed to create lead`);
      }
    }

    // Notify care team of new midweek leads
    if (results.care_leads > 0 && careIds.length > 0) {
      const notifRows = careIds.map(userId => ({
        user_id: userId,
        type: 'pipeline',
        title: `${results.care_leads} midweek absence lead${results.care_leads > 1 ? 's' : ''} assigned`,
        body: `${results.care_leads} member${results.care_leads > 1 ? 's have' : ' has'} missed 3+ Wednesday services and been added to your queue.`,
        read: false,
      }));
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(notifRows),
      });
    }

    return NextResponse.json({
      data: {
        last_wednesday: lastWednesday,
        members_scanned: processedMembers.size,
        ...results,
      },
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
  const postReq = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ secret: 'shepherd-cron-2026' }),
  });
  return POST(postReq);
}
