export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  resolvePollParent, getPoll, isPollClosed, canSeeFullPollDetail,
  getEligibleFeedAudience, getChurchStructureCfg, computeStructuralBreakdown,
  computeEngagementTimeline, type AudienceUser, type FeedPollGroup,
} from '@/lib/poll-analytics';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// The "command data center" analytics endpoint — restricted to the
// poll's creator and leadership (canSeeFullPollDetail), same church.
// Fixed visibility model, no per-poll flag: anyone who isn't in that set
// gets a 403 here and only ever sees the aggregate tally already embedded
// in the plain poll card from GET /api/feed/posts. Everyone who CAN reach
// this endpoint gets full per-voter attribution unconditionally — that's
// simply what "being the person who needs the poll" means in this app.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ data: null, error: { message: 'Only the poll creator or a leader can view its analytics' } }, { status: 403 });
    }

    const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${parent.groupId}&select=id,type,department_id,branch_id,church_id&limit=1`, { headers: H() });
    const group: FeedPollGroup = (await groupRes.json().catch(() => []))?.[0];
    if (!group) return NextResponse.json({ data: null, error: { message: 'Poll group not found' } }, { status: 404 });

    const [options, votes, audience, cfg] = await Promise.all([
      fetch(`${S}/rest/v1/feed_poll_options?poll_id=eq.${pollId}&order=display_order.asc&select=id,option_text,display_order`, { headers: H() }).then(r => r.json()).catch(() => []),
      fetch(`${S}/rest/v1/feed_poll_votes?poll_id=eq.${pollId}&select=option_id,user_id,voted_at`, { headers: H() }).then(r => r.json()).catch(() => []),
      getEligibleFeedAudience(group),
      getChurchStructureCfg(group.church_id),
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

    // ── Response rate ──
    const responseRate = {
      responded: distinctVoterIds.length,
      audience_size: audienceRows.length,
      pct: audienceRows.length > 0 ? Math.round((distinctVoterIds.length / audienceRows.length) * 1000) / 10 : null,
    };

    // ── Structural breakdown ──
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

    // ── Non-responder list — visible to this endpoint's audience
    // regardless of anything about the poll; never carries a vote choice
    // (there isn't one). Name + structural context only, for follow-up. ──
    const respondedSet = new Set(distinctVoterIds);
    const nonResponders = audienceRows
      .filter(a => !respondedSet.has(a.id))
      .map(a => ({ id: a.id, full_name: a.full_name, role: a.role, branch_id: a.branch_id, cell_id: a.cell_id, fellowship_id: a.fellowship_id, department_id: a.department_id }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    // ── Full per-voter attribution — always included here; this route is
    // already restricted to creator/leadership, so there is no further
    // gate to apply. Resolved against the voters themselves (not just the
    // audience list) so a leadership vote outside the formal audience
    // (e.g. an overseer voting in a department poll for oversight) is
    // still correctly attributed rather than silently dropped. ──
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
    console.error('[GET /api/feed/polls/[id]/results]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load poll analytics' } }, { status: 500 });
  }
}
