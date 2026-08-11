import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { assignToLeastLoadedCareTeamMember } from '@/lib/care-assignment';
import { notifyUsers } from '@/lib/notify';

// ── This endpoint scans last Sunday's attendance and creates care leads
// ── for any member absent 1+ Sunday with no open lead already.
// ── Runs once per church so one church's absentees never land in
// ── another's care queue — see runForChurch() below.
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

type ChurchResults = { church_id: string; leads_created: number; leads_skipped: number; errors: string[]; message?: string };

async function runForChurch(churchId: string, lastSunday: string): Promise<ChurchResults> {
  const results: ChurchResults = { church_id: churchId, leads_created: 0, leads_skipped: 0, errors: [] };

  // 1. Get last Sunday's service for this church
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
    results.message = 'No absent members found for last Sunday';
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
        weeks_absent: 1,
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
      body: `${results.leads_created} member${results.leads_created > 1 ? 's were' : ' was'} absent last Sunday and assigned to your queue. Please follow up by Wednesday.`,
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

    const lastSunday = getLastSunday();

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
      perChurch.push(await runForChurch(churchId, lastSunday));
    }

    const totals = perChurch.reduce((acc, r) => ({
      leads_created: acc.leads_created + r.leads_created,
      leads_skipped: acc.leads_skipped + r.leads_skipped,
    }), { leads_created: 0, leads_skipped: 0 });

    return NextResponse.json({
      data: { service_date: lastSunday, ...totals, churches: perChurch },
      error: null,
    });

  } catch (err) {
    console.error('[POST /api/care/trigger-alerts]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to trigger alerts' } }, { status: 500 });
  }
}

// GET — manual trigger from dashboard, overseer/pa/lead_tech only.
// Scoped to the calling user's own church only — an overseer triggering
// this manually should never sweep every other church too.
export async function GET(req: Request) {
  try {
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
