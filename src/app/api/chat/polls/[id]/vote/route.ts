export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireChatAccess } from '@/lib/plan-gate';
import {
  resolvePollParent, getPoll, castPollVote, buildPollView,
  type PollOptionRow, type PollVoteRow,
} from '@/lib/poll-analytics';

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

// Cast or change a vote on a group-chat poll. `[id]` is the poll id
// (feed_polls.id), not the message id — the message/thread are resolved
// from it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const chatBlocked = await requireChatAccess(user.church_id, user.role, user.id);
    if (chatBlocked) return chatBlocked;
    const { id: pollId } = await params;

    const parent = await resolvePollParent(pollId);
    if (!parent || parent.kind !== 'chat') return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });
    // chat_messages has no church_id of its own — verify the poll's
    // message's thread belongs to this caller's church AND that they're
    // an actual participant of that thread before allowing a vote,
    // otherwise a guessed/leaked poll id from another church/thread could
    // be voted on here — same two-step check every other chat route uses.
    if (parent.churchId !== user.church_id) return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });
    if (!(await isParticipant(parent.threadId, user.id))) {
      return NextResponse.json({ data: null, error: { message: 'Not a participant in this chat' } }, { status: 403 });
    }

    const poll = await getPoll(pollId);
    if (!poll) return NextResponse.json({ data: null, error: { message: 'Poll not found' } }, { status: 404 });

    const { option_ids } = await req.json().catch(() => ({ option_ids: [] }));
    if (!Array.isArray(option_ids) || option_ids.length === 0) {
      return NextResponse.json({ data: null, error: { message: 'option_ids is required' } }, { status: 400 });
    }

    const result = await castPollVote(poll, user.id, option_ids);
    if (!result.ok) return NextResponse.json({ data: null, error: { message: result.message } }, { status: result.status });

    const [optsRes, votesRes] = await Promise.all([
      fetch(`${S}/rest/v1/feed_poll_options?poll_id=eq.${pollId}&order=display_order.asc&select=id,option_text,display_order`, { headers: H() }),
      fetch(`${S}/rest/v1/feed_poll_votes?poll_id=eq.${pollId}&select=option_id,user_id`, { headers: H() }),
    ]);
    const options: PollOptionRow[] = await optsRes.json().catch(() => []);
    const votes: PollVoteRow[] = await votesRes.json().catch(() => []);

    return NextResponse.json({ data: { poll: buildPollView(poll, Array.isArray(options) ? options : [], Array.isArray(votes) ? votes : [], { id: user.id, role: user.role }) }, error: null });
  } catch (err) {
    console.error('[POST /api/chat/polls/[id]/vote]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to record your vote' } }, { status: 500 });
  }
}
