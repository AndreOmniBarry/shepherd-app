export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { notifyUsersChecked } from '@/lib/notify';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

const CATEGORY_CFG: Record<string, { title: string }> = {
  commendation: { title: 'You have been commended!' },
  encouragement: { title: 'A word of encouragement' },
  announcement: { title: 'Announcement' },
  meeting: { title: 'Meeting request' },
};

// Resolves a "send to" scope into the actual list of user ids to notify —
// one leader, every leader under a fellowship (its head + every cell
// leader under it), every leader under a department, or every leader in
// the branch. No group has ever needed this before; commendations only
// ever went to one hand-picked leader at a time until now.
async function resolveRecipients(scope: string, opts: { leader_id?: string; fellowship_id?: string; department_id?: string; branch_id?: string | null; church_id?: string | null }): Promise<string[]> {
  if (scope === 'individual') return opts.leader_id ? [opts.leader_id] : [];
  const churchFilter = opts.church_id ? `&church_id=eq.${opts.church_id}` : '';

  // is_active=eq.true on every query below: every other role-list resolver
  // in this app (mention-groups.ts, admin/users, ...) excludes suspended/
  // deactivated accounts. This one didn't, so a "commend everyone" could
  // report a real recipient_count and a 201 while some (or, in a church
  // whose active leaders had all been reassigned/suspended, effectively
  // all) of those ids belonged to accounts nobody was actually watching —
  // "it said success but nobody saw it" with no error anywhere to catch it.
  if (scope === 'fellowship' && opts.fellowship_id) {
    const [headRes, cellsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.fellowship_head&fellowship_id=eq.${opts.fellowship_id}&is_active=eq.true${churchFilter}&select=id`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/cells?fellowship_id=eq.${opts.fellowship_id}${churchFilter}&select=id`, { headers: hdrs() }),
    ]);
    const heads = await headRes.json().catch(() => []);
    const cells = await cellsRes.json().catch(() => []);
    const cellIds = (Array.isArray(cells) ? cells : []).map((c: { id: string }) => c.id);
    let leaderIds: string[] = [];
    if (cellIds.length > 0) {
      const leadersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.cell_leader&cell_id=in.(${cellIds.join(',')})&is_active=eq.true${churchFilter}&select=id`, { headers: hdrs() });
      const leaders = await leadersRes.json().catch(() => []);
      leaderIds = (Array.isArray(leaders) ? leaders : []).map((l: { id: string }) => l.id);
    }
    return [...(Array.isArray(heads) ? heads.map((h: { id: string }) => h.id) : []), ...leaderIds];
  }

  if (scope === 'department' && opts.department_id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.department_head&department_id=eq.${opts.department_id}&is_active=eq.true${churchFilter}&select=id`, { headers: hdrs() });
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data.map((u: { id: string }) => u.id) : [];
  }

  if (scope === 'all') {
    const branchFilter = opts.branch_id ? `&branch_id=eq.${opts.branch_id}` : '';
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?role=in.(cell_leader,fellowship_head,department_head)&is_active=eq.true&select=id${branchFilter}${churchFilter}`, { headers: hdrs() });
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data.map((u: { id: string }) => u.id) : [];
  }

  return [];
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
    }

    const { leader_id, commendation, category, scope, fellowship_id, department_id } = await req.json();
    if (!commendation?.trim()) {
      return NextResponse.json({ data: null, error: { message: 'A message is required' } }, { status: 400 });
    }

    // scope === 'all' resolves to "every leader in the caller's branch"
    // via opts.branch_id below — for a branch_pastor with no branch_id
    // assigned yet, that must mean "no recipients", not silently fall
    // through to every leader in the whole church.
    if ((scope || 'individual') === 'all' && user.role === 'branch_pastor' && !user.branch_id) {
      return NextResponse.json({ data: null, error: { message: 'No recipients found for that selection' } }, { status: 400 });
    }

    const recipients = await resolveRecipients(scope || 'individual', { leader_id, fellowship_id, department_id, branch_id: user.branch_id, church_id: user.church_id });
    if (recipients.length === 0) {
      return NextResponse.json({ data: null, error: { message: 'No recipients found for that selection' } }, { status: 400 });
    }

    // A "meeting" message creates real, interactive meeting_requests rows
    // (so the recipient gets Accept/Decline in Church Center, not just a
    // one-way notification) in addition to the notification itself.
    if (category === 'meeting') {
      await fetch(`${SUPABASE_URL}/rest/v1/meeting_requests`, {
        method: 'POST', headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(recipients.map(uid => ({
          branch_id: user.branch_id || null,
          church_id: user.church_id || null,
          requested_by: user.id,
          requested_of: uid,
          subject: commendation.trim().slice(0, 80),
          message: commendation.trim(),
        }))),
      }).catch(() => {});
    }

    const cfg = CATEGORY_CFG[category] || CATEGORY_CFG.commendation;
    const result = await notifyUsersChecked(recipients, {
      type: category === 'commendation' ? 'commendation' : category === 'meeting' ? 'meeting_request' : 'pastoral',
      title: cfg.title,
      body: commendation.trim(),
      link: category === 'meeting' ? '/church-center?tab=meetings' : category === 'commendation' ? '/church-center?tab=recognition' : '/church-center',
    }, user.church_id);

    if (!result.ok) {
      return NextResponse.json({ data: null, error: { message: result.error ? `Failed to send: ${result.error}` : 'Failed to send' } }, { status: 502 });
    }

    return NextResponse.json({ data: { sent: true, recipient_count: recipients.length, category: category || null }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/recognition/commend]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to send' } }, { status: 500 });
  }
}
