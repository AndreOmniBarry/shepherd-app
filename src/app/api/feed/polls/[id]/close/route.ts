export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { resolvePollParent, getPoll, isPollClosed, canSeeFullPollDetail } from '@/lib/poll-analytics';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Manual close — only the poll's creator or a leadership role, same
// church. Idempotent: closing an already-closed poll is a no-op success.
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
      return NextResponse.json({ data: null, error: { message: 'Only the poll creator or a leader can close this poll' } }, { status: 403 });
    }

    if (isPollClosed(poll)) return NextResponse.json({ data: { closed: true }, error: null });

    const patchRes = await fetch(`${S}/rest/v1/feed_polls?id=eq.${pollId}`, {
      method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ closed_at: new Date().toISOString(), closed_by: user.id }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text().catch(() => '');
      console.error('[POST /api/feed/polls/[id]/close]', patchRes.status, err);
      return NextResponse.json({ data: null, error: { message: 'Failed to close poll' } }, { status: 502 });
    }

    return NextResponse.json({ data: { closed: true }, error: null });
  } catch (err) {
    console.error('[POST /api/feed/polls/[id]/close]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to close poll' } }, { status: 500 });
  }
}
