export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireChatAccess } from '@/lib/plan-gate';
import { resolvePollParent, getPoll, isPollClosed, canSeeFullPollDetail } from '@/lib/poll-analytics';

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

// Manual close — only the poll's creator or a leadership role who is also
// a participant of the thread, same church. Idempotent.
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
      return NextResponse.json({ data: null, error: { message: 'Only the poll creator or a leader can close this poll' } }, { status: 403 });
    }

    if (isPollClosed(poll)) return NextResponse.json({ data: { closed: true }, error: null });

    const patchRes = await fetch(`${S}/rest/v1/feed_polls?id=eq.${pollId}`, {
      method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ closed_at: new Date().toISOString(), closed_by: user.id }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text().catch(() => '');
      console.error('[POST /api/chat/polls/[id]/close]', patchRes.status, err);
      return NextResponse.json({ data: null, error: { message: 'Failed to close poll' } }, { status: 502 });
    }

    return NextResponse.json({ data: { closed: true }, error: null });
  } catch (err) {
    console.error('[POST /api/chat/polls/[id]/close]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to close poll' } }, { status: 500 });
  }
}
