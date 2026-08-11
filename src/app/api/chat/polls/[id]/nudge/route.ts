export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireChatAccess } from '@/lib/plan-gate';
import { notifyUsers } from '@/lib/notify';
import { resolvePollParent, getPoll, isPollClosed, canSeeFullPollDetail, getEligibleChatAudience } from '@/lib/poll-analytics';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

async function isParticipant(threadId: string, userId: string): Promise<boolean> {
  const res = await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&user_id=eq.${userId}&select=user_id&limit=1`, { headers: H() });
  const data = await res.json().catch(() => []);
  return Array.isArray(data) && data.length > 0;
}

// Fans a reminder notification out to the current non-responder list for a
// group-chat poll. Leadership-only (creator or LEADERSHIP), same church +
// same thread. Reuses the existing `system` notification type.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const chatBlocked = await requireChatAccess(user.church_id, user.role, user.id);
    if (chatBlocked) return chatBlocked;
    const { id: pollId } = await params;

    const parent = await resolvePollParent(pollId);
    if (!parent || parent.kind !== 'chat') return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });
    if (parent.churchId !== user.church_id) return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });
    if (!(await isParticipant(parent.threadId, user.id))) {
      return NextResponse.json({ data: null, error: { message: 'Not a participant in this chat' } }, { status: 403 });
    }

    const poll = await getPoll(pollId);
    if (!poll) return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });
    if (!canSeeFullPollDetail(poll.created_by, { id: user.id, role: user.role })) {
      return NextResponse.json({ data: null, error: { message: 'Only the poll creator or a leader can nudge non-voters' } }, { status: 403 });
    }
    if (isPollClosed(poll)) {
      return NextResponse.json({ data: null, error: { message: 'This poll is closed — nothing to nudge' } }, { status: 409 });
    }

    const [audience, votesRes] = await Promise.all([
      getEligibleChatAudience(parent.threadId, parent.churchId),
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
      link: `/chat?thread=${parent.threadId}`,
    }, user.church_id);

    return NextResponse.json({ data: { nudged: nonResponderIds.length }, error: null });
  } catch (err) {
    console.error('[POST /api/chat/polls/[id]/nudge]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to nudge non-voters' } }, { status: 500 });
  }
}
