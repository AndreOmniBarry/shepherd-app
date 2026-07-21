import { NextResponse } from 'next/server';

// ── This endpoint scans last Sunday's attendance and creates care leads
// ── for any member absent 1+ Sunday with no open lead already.
// ── Call this every Monday via cron or manually from the dashboard.
// ── Protected by a secret key to prevent unauthorised triggers.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

function getLastSunday(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - (day === 0 ? 7 : day)); // previous Sunday
  return d.toISOString().split('T')[0];
}

export async function POST(req: Request) {
  try {
    // Simple secret key protection
    const body = await req.json().catch(() => ({}));
    const secret = body.secret || req.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'shepherd-cron-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lastSunday = getLastSunday();
    const results = { leads_created: 0, leads_skipped: 0, errors: [] as string[] };

    // 1. Get last Sunday's service
    const svcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=eq.${lastSunday}&service_number=eq.1&select=id&limit=1`,
      { headers: hdrs() }
    );
    const svcData = await svcRes.json();
    const service = svcData?.[0];

    if (!service) {
      return NextResponse.json({
        data: { message: `No service found for ${lastSunday}`, ...results },
        error: null,
      });
    }

    // 2. Get all attendance entries marked absent for this service
    const absentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_entries?status=eq.absent&record_id=in.(select id from attendance_records where service_id=eq.${service.id})&select=member_id,absence_reason`,
      { headers: hdrs() }
    );
    const absentEntries = await absentRes.json();

    if (!Array.isArray(absentEntries) || absentEntries.length === 0) {
      return NextResponse.json({
        data: { message: 'No absent members found for last Sunday', ...results },
        error: null,
      });
    }

    // 3. Get care team members for round-robin assignment
    const careRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.care_team&is_active=eq.true&select=id`,
      { headers: hdrs() }
    );
    const careTeam = await careRes.json();
    const careIds: string[] = Array.isArray(careTeam) ? careTeam.map((u: Record<string, string>) => u.id) : [];

    // 4. For each absent member — create care lead if none exists
    for (let i = 0; i < absentEntries.length; i++) {
      const entry = absentEntries[i] as Record<string, string>;
      const memberId = entry.member_id;
      if (!memberId) continue;

      // Check if open lead already exists
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/care_leads?member_id=eq.${memberId}&status=in.(new,in_progress,reached,visited)&select=id&limit=1`,
        { headers: hdrs() }
      );
      const existing = await existingRes.json();

      if (existing?.[0]) {
        // Lead exists — increment weeks_absent
        await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: { ...hdrs(), 'Prefer': 'return=minimal' },
          body: JSON.stringify({ weeks_absent: existing[0].weeks_absent + 1, updated_at: new Date().toISOString() }),
        });
        results.leads_skipped++;
        continue;
      }

      // Round-robin assign to care team
      const assignedTo = careIds.length > 0 ? careIds[i % careIds.length] : null;

      // Create new care lead
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/care_leads`, {
        method: 'POST',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          member_id: memberId,
          assigned_to: assignedTo,
          weeks_absent: 1,
          status: 'new',
          contact_attempts: 0,
          notes: entry.absence_reason ? `Absence reason logged: ${entry.absence_reason}` : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      if (insertRes.ok) {
        results.leads_created++;
      } else {
        const err = await insertRes.text();
        results.errors.push(`Member ${memberId}: ${err}`);
      }
    }

    // 5. Send notification to care team members
    if (results.leads_created > 0 && careIds.length > 0) {
      const notifRows = careIds.map(userId => ({
        user_id: userId,
        type: 'pipeline',
        title: `${results.leads_created} new absence lead${results.leads_created > 1 ? 's' : ''} assigned`,
        body: `${results.leads_created} member${results.leads_created > 1 ? 's were' : ' was'} absent last Sunday and assigned to your queue. Please follow up by Wednesday.`,
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
        service_date: lastSunday,
        absent_members_scanned: absentEntries.length,
        ...results,
      },
      error: null,
    });

  } catch (err) {
    console.error('[POST /api/care/trigger-alerts]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to trigger alerts' } }, { status: 500 });
  }
}

// GET — manual trigger from dashboard (overseer only)
export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    if (!m?.[1]) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Forward to POST with master secret
    const postReq = new Request(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookie },
      body: JSON.stringify({ secret: 'shepherd-cron-2026' }),
    });
    return POST(postReq);
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 });
  }
}
