export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireChatAccess } from '@/lib/plan-gate';
import {
  resolvePollParent, getPoll, isPollClosed, canSeeFullPollDetail,
  getEligibleChatAudience, getChurchStructureCfg, computeStructuralBreakdown,
  computeEngagementTimeline, type AudienceUser,
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

// Analytics for a group-chat poll — restricted to the poll's creator or a
// leadership-role participant of the thread (canSeeFullPollDetail), same
// fixed two-tier model as Church Feed polls. The eligible audience here
// is the thread's actual chat_participants list, NOT the church/branch/
// department structural-scope calculation the feed version uses — a group
// chat's membership is whoever was actually added to it.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ data: null, error: { message: 'Only the poll creator or a leader can view its analytics' } }, { status: 403 });
    }

    const [options, votes, audience, cfg] = await Promise.all([
      fetch(`${S}/rest/v1/feed_poll_options?poll_id=eq.${pollId}&order=display_order.asc&select=id,option_text,display_order`, { headers: H() }).then(r => r.json()).catch(() => []),
      fetch(`${S}/rest/v1/feed_poll_votes?poll_id=eq.${pollId}&select=option_id,user_id,voted_at`, { headers: H() }).then(r => r.json()).catch(() => []),
      getEligibleChatAudience(parent.threadId, parent.churchId),
      getChurchStructureCfg(parent.churchId),
    ]);
    const optionRows: { id: string; option_text: string; display_order: number }[] = Array.isArray(options) ? options : [];
    const voteRows: { option_id: string; user_id: string; voted_at: string }[] = Array.isArray(votes) ? votes : [];
    const audienceRows: AudienceUser[] = Array.isArray(audience) ? audience : [];
    const audienceById = new Map(audienceRows.map(a => [a.id, a]));

    // ── Live tally ──
    const distinctVoterIds = [...new Set(voteRows.map(v => v.user_id))];
    const countByOption = new Map<string, number>();
    voteRows.forEach(v => countByOption.set(v.option_id, (countByOption.get(v.option_id) || 0) + 1));
    const tally = optionRows.map(o => ({
      option_id: o.id, option_text: o.option_text,
      count: countByOption.get(o.id) || 0,
      pct: distinctVoterIds.length > 0 ? Math.round(((countByOption.get(o.id) || 0) / distinctVoterIds.length) * 1000) / 10 : 0,
    }));

    // ── Response rate — against the thread's own participant list ──
    const responseRate = {
      responded: distinctVoterIds.length,
      audience_size: audienceRows.length,
      pct: audienceRows.length > 0 ? Math.round((distinctVoterIds.length / audienceRows.length) * 1000) / 10 : null,
    };

    // ── Structural breakdown (still meaningful — which cells/branches
    // are represented among this group's actual respondents) ──
    const breakdown = await computeStructuralBreakdown(voteRows, audienceById, optionRows, cfg);

    // ── Engagement timeline ──
    const latestVoteByUser = new Map<string, Date>();
    voteRows.forEach(v => {
      const ts = new Date(v.voted_at);
      const prev = latestVoteByUser.get(v.user_id);
      if (!prev || ts > prev) latestVoteByUser.set(v.user_id, ts);
    });
    const endAt = poll.closed_at ? new Date(poll.closed_at) : (isPollClosed(poll) && poll.closes_at ? new Date(poll.closes_at) : new Date());
    const timeline = computeEngagementTimeline([...latestVoteByUser.values()], new Date(poll.created_at), endAt);

    // ── Non-responder list — thread participants who haven't voted ──
    const respondedSet = new Set(distinctVoterIds);
    const nonResponders = audienceRows
      .filter(a => !respondedSet.has(a.id))
      .map(a => ({ id: a.id, full_name: a.full_name, role: a.role, branch_id: a.branch_id, cell_id: a.cell_id, fellowship_id: a.fellowship_id, department_id: a.department_id }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    // ── Full per-voter attribution — always included here; this route is
    // already restricted to creator/leadership. ──
    let voters: { id: string; full_name: string; role: string }[] = [];
    if (distinctVoterIds.length > 0) {
      const votersRes = await fetch(`${S}/rest/v1/users?id=in.(${distinctVoterIds.join(',')})&select=id,full_name,role`, { headers: H() });
      voters = await votersRes.json().catch(() => []);
    }
    const voterNameById = new Map((Array.isArray(voters) ? voters : []).map(v => [v.id, { full_name: v.full_name, role: v.role }]));
    const perOptionVoters = optionRows.map(o => ({
      option_id: o.id,
      option_text: o.option_text,
      voters: voteRows.filter(v => v.option_id === o.id).map(v => ({
        user_id: v.user_id,
        full_name: voterNameById.get(v.user_id)?.full_name || 'Unknown',
        role: voterNameById.get(v.user_id)?.role || '',
        voted_at: v.voted_at,
      })).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    }));

    return NextResponse.json({
      data: {
        poll: { id: poll.id, question: poll.question, poll_type: poll.poll_type, allow_vote_change: poll.allow_vote_change, closes_at: poll.closes_at, closed_at: poll.closed_at, closed_by: poll.closed_by, created_by: poll.created_by, created_at: poll.created_at, is_closed: isPollClosed(poll) },
        tally,
        response_rate: responseRate,
        structural_breakdown: breakdown,
        engagement_timeline: timeline,
        non_responders: nonResponders,
        per_option_voters: perOptionVoters,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/chat/polls/[id]/results]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load poll analytics' } }, { status: 500 });
  }
}
