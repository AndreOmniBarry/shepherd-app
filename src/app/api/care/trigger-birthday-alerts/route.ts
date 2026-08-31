import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { notifyUsers } from '@/lib/notify';

// ── Birthday notification engine ───────────────────────────────────────
// Runs automatically every day via Vercel Cron (see vercel.json), once
// per church so one church's members never notify another's leadership.
// For every active member whose birthday is today:
//   1. Notifies their own leadership chain — cell leader, fellowship head,
//      any department head(s) they serve under (i.e. if they're part of
//      the workforce), and the church's senior leadership (branch pastor
//      + PA for their own branch, general overseer/overseer church-wide).
//      The birthday member themselves is excluded from this list even if
//      they hold one of these roles — see `ownUserId` below — they get
//      the in-app banner instead (see /api/auth/me's is_birthday_today),
//      not a notice about their own birthday.
//   2. Posts once to that member's own branch's Church Feed (falling back
//      to the church-wide feed if the church has no per-branch feed, or
//      the member has no branch) — "It's <Name>'s birthday today! Send
//      them your best wishes."
// This intentionally does NOT try to dedupe against being re-run the same
// day (a manual admin re-run, or a retried cron invocation) — same as the
// two sibling absence-alert crons, which have no such guard either.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

type BirthdayMember = { id: string; full_name: string; date_of_birth: string; cell_id: string | null; branch_id: string | null };

function isBirthdayToday(dob: string, today: Date): boolean {
  const [, bmStr, bdStr] = dob.split('-');
  return parseInt(bmStr, 10) - 1 === today.getMonth() && parseInt(bdStr, 10) === today.getDate();
}

type ChurchResults = { church_id: string; members_celebrated: number; notified: number; feed_posts: number; errors: string[] };

async function runForChurch(churchId: string): Promise<ChurchResults> {
  const results: ChurchResults = { church_id: churchId, members_celebrated: 0, notified: 0, feed_posts: 0, errors: [] };
  const today = new Date();

  const membersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/members?church_id=eq.${churchId}&membership_status=eq.active&date_of_birth=not.is.null&select=id,full_name,date_of_birth,cell_id,branch_id`,
    { headers: hdrs() }
  );
  const allMembers: BirthdayMember[] = await membersRes.json().catch(() => []);
  const celebrants = (Array.isArray(allMembers) ? allMembers : []).filter(m => isBirthdayToday(m.date_of_birth, today));
  if (celebrants.length === 0) return results;

  // Church-wide leadership — same for every celebrant regardless of branch.
  const seniorRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=in.(overseer,general_overseer)&is_active=eq.true&church_id=eq.${churchId}&select=id`, { headers: hdrs() });
  const seniorLeadership: string[] = (await seniorRes.json().catch(() => [])).map((u: { id: string }) => u.id);

  for (const member of celebrants) {
    results.members_celebrated++;
    const recipientIds = new Set<string>(seniorLeadership);

    // Own login account, if any — excluded from the notify set below (they
    // get the in-app banner instead of a notice about their own birthday).
    const ownUserRes = await fetch(`${SUPABASE_URL}/rest/v1/users?member_id=eq.${member.id}&select=id&limit=1`, { headers: hdrs() });
    const ownUser = await ownUserRes.json().catch(() => []);
    const ownUserId: string | null = ownUser?.[0]?.id || null;

    let cellName = '—';
    let fellowshipName = '—';
    if (member.cell_id) {
      const cellRes = await fetch(`${SUPABASE_URL}/rest/v1/cells?id=eq.${member.cell_id}&select=name,fellowship_id,fellowships(name)&limit=1`, { headers: hdrs() });
      const cellRows = await cellRes.json().catch(() => []);
      const cell = cellRows?.[0];
      if (cell) {
        cellName = cell.name || '—';
        fellowshipName = cell.fellowships?.name || '—';

        const leaderRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.cell_leader&cell_id=eq.${member.cell_id}&is_active=eq.true&church_id=eq.${churchId}&select=id`, { headers: hdrs() });
        (await leaderRes.json().catch(() => [])).forEach((u: { id: string }) => recipientIds.add(u.id));

        if (cell.fellowship_id) {
          const headRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.fellowship_head&fellowship_id=eq.${cell.fellowship_id}&is_active=eq.true&church_id=eq.${churchId}&select=id`, { headers: hdrs() });
          (await headRes.json().catch(() => [])).forEach((u: { id: string }) => recipientIds.add(u.id));
        }
      }
    }

    // Workforce — any department(s) this member actively serves in.
    const deptMembershipRes = await fetch(`${SUPABASE_URL}/rest/v1/department_members?member_id=eq.${member.id}&select=department_id`, { headers: hdrs() });
    const deptMemberships = await deptMembershipRes.json().catch(() => []);
    const departmentIds: string[] = [...new Set((Array.isArray(deptMemberships) ? deptMemberships : []).map((d: { department_id: string }) => d.department_id).filter(Boolean))];
    if (departmentIds.length > 0) {
      const deptHeadRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.department_head&department_id=in.(${departmentIds.join(',')})&is_active=eq.true&church_id=eq.${churchId}&select=id`, { headers: hdrs() });
      (await deptHeadRes.json().catch(() => [])).forEach((u: { id: string }) => recipientIds.add(u.id));
    }

    // Branch's own pastor + PA — a PA with no branch_id (church-wide PA)
    // is included for every branch; one scoped to a specific branch only
    // for that branch's own celebrants.
    if (member.branch_id) {
      const branchLeadersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=in.(branch_pastor,pa)&is_active=eq.true&church_id=eq.${churchId}&select=id,role,branch_id`, { headers: hdrs() });
      const branchLeaders = await branchLeadersRes.json().catch(() => []);
      (Array.isArray(branchLeaders) ? branchLeaders : []).forEach((u: { id: string; role: string; branch_id: string | null }) => {
        if (u.role === 'branch_pastor' && u.branch_id === member.branch_id) recipientIds.add(u.id);
        if (u.role === 'pa' && (u.branch_id === null || u.branch_id === member.branch_id)) recipientIds.add(u.id);
      });
    } else {
      const paRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.pa&is_active=eq.true&church_id=eq.${churchId}&select=id`, { headers: hdrs() });
      (await paRes.json().catch(() => [])).forEach((u: { id: string }) => recipientIds.add(u.id));
    }

    if (ownUserId) recipientIds.delete(ownUserId);

    const firstName = member.full_name.split(' ')[0];
    if (recipientIds.size > 0) {
      await notifyUsers([...recipientIds], {
        type: 'birthday',
        title: `🎂 ${member.full_name}'s birthday is today`,
        body: `${cellName !== '—' ? `${cellName} (${fellowshipName}) · ` : ''}Send them your best wishes today.`,
        link: '/care?tab=birthdays',
      }, churchId);
      results.notified += recipientIds.size;
    }

    // Church Feed post — this member's own branch feed if one exists,
    // otherwise the church-wide (null-branch) feed. Never blocks the
    // notifications above if feed_groups isn't set up for this church.
    try {
      let groupId: string | null = null;
      if (member.branch_id) {
        const branchGroupRes = await fetch(`${SUPABASE_URL}/rest/v1/feed_groups?type=eq.church&church_id=eq.${churchId}&branch_id=eq.${member.branch_id}&select=id&limit=1`, { headers: hdrs() });
        const branchGroup = await branchGroupRes.json().catch(() => []);
        groupId = branchGroup?.[0]?.id || null;
      }
      if (!groupId) {
        const churchGroupRes = await fetch(`${SUPABASE_URL}/rest/v1/feed_groups?type=eq.church&church_id=eq.${churchId}&branch_id=is.null&select=id&limit=1`, { headers: hdrs() });
        const churchGroup = await churchGroupRes.json().catch(() => []);
        groupId = churchGroup?.[0]?.id || null;
      }
      if (groupId) {
        const postRes = await fetch(`${SUPABASE_URL}/rest/v1/feed_posts`, {
          method: 'POST', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            group_id: groupId, author_id: null, author_name: 'SHEP.HERD', author_role: 'system',
            body: `🎂 It's ${firstName}'s birthday today! Send them your best wishes.`,
            urgent: false, pinned: false,
          }),
        });
        if (postRes.ok) results.feed_posts++;
        else results.errors.push(`Member ${member.id}: feed post failed (${postRes.status})`);
      }
    } catch (err) {
      results.errors.push(`Member ${member.id}: feed post threw`);
      console.error('[trigger-birthday-alerts] feed post failed', err);
    }
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
      members_celebrated: acc.members_celebrated + r.members_celebrated,
      notified: acc.notified + r.notified,
      feed_posts: acc.feed_posts + r.feed_posts,
    }), { members_celebrated: 0, notified: 0, feed_posts: 0 });

    return NextResponse.json({ data: { ...totals, churches: perChurch }, error: null });
  } catch (err) {
    console.error('[POST /api/care/trigger-birthday-alerts]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to trigger birthday alerts' } }, { status: 500 });
  }
}

// Same two-caller split as the other care/trigger-* crons: Vercel Cron
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
