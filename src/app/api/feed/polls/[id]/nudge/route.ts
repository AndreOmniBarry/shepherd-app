export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { notifyUsers } from '@/lib/notify';
import { resolvePollParent, getPoll, isPollClosed, canSeeFullPollDetail, getEligibleFeedAudience, type FeedPollGroup } from '@/lib/poll-analytics';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Fans a reminder notification out to the current non-responder list.
// Leadership-only (creator or LEADERSHIP), same church — the exact same
// audience allowed to view /results, since the non-responder list itself
// only exists there. Reuses the existing `system` notification type
// (already in the notifications_type_check constraint per
// scripts/28_fix_notifications_type_check.sql) rather than adding a new
// one — "poll nudge" is exactly the kind of app-generated system nudge
// that type already covers, no new CHECK value needed.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { id: pollId } = await params;

    const parent = await resolvePollParent(pollId);
    if (!parent || parent.kind !== 'feed') return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });
    if (parent.churchId !== user.church_id) return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });

    const poll = await getPoll(pollId);
    if (!poll) return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });
    if (!canSeeFullPollDetail(poll.created_by, { id: user.id, role: user.role })) {
      return NextResponse.json({ data: null, error: { message: 'Only the poll creator or a leader can nudge non-voters' } }, { status: 403 });
    }
    if (isPollClosed(poll)) {
      return NextResponse.json({ data: null, error: { message: 'This poll is closed — nothing to nudge' } }, { status: 409 });
    }

    const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${parent.groupId}&select=id,type,department_id,branch_id,church_id&limit=1`, { headers: H() });
    const group: FeedPollGroup = (await groupRes.json().catch(() => []))?.[0];
    if (!group) return NextResponse.json({ data: null, error: { message: 'Poll group not found' } }, { status: 404 });

    const [audience, votesRes] = await Promise.all([
      getEligibleFeedAudience(group),
      fetch(`${S}/rest/v1/feed_poll_votes?poll_id=eq.${pollId}&select=user_id`, { headers: H() }),
    ]);
    const votedIds = new Set(((await votesRes.json().catch(() => [])) as { user_id: string }[]).map(v => v.user_id));
    const nonResponderIds = audience.filter(a => !votedIds.has(a.id)).map(a => a.id).filter(id => id !== user.id);

    if (nonResponderIds.length === 0) {
      return NextResponse.json({ data: { nudged: 0 }, error: null });
    }

    await notifyUsers(nonResponderIds, {
      type: 'system',
      title: 'Please respond to a poll',
      body: `${user.name || 'A leader'} is waiting on your response: "${poll.question}"`,
      link: `/church-feed?post=${parent.postId}`,
    }, user.church_id);

    return NextResponse.json({ data: { nudged: nonResponderIds.length }, error: null });
  } catch (err) {
    console.error('[POST /api/feed/polls/[id]/nudge]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to nudge non-voters' } }, { status: 500 });
  }
}
