export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { extractGroupMentions } from '@/lib/mention-groups';
import { notifyUsers } from '@/lib/notify';
import { buildPollView, type PollRow, type PollOptionRow, type PollVoteRow } from '@/lib/poll-analytics';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

const LEADERSHIP = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];
const DELETED_BODY = 'This post was deleted';
const POST_SELECT = 'id,author_id,author_name,author_role,body,urgent,pinned,created_at,deleted_at,deleted_by,media_url,media_type,poll_id';

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Attaches poll data (question/options/tally/my-vote) to every post whose
// poll_id is set, via buildPollView — the single shared place that
// decides when tallies become visible (Telegram convention: hidden from a
// plain voter until they've cast a ballot, the poll closes, or they're
// the creator/leadership) so this can never drift from the vote routes'
// own idea of the same gating. This is the aggregate-only side of the
// fixed visibility model; full per-voter attribution never appears here
// regardless of who's asking — that only ever comes from
// GET /api/feed/polls/[id]/results, itself restricted to creator/leadership.
async function attachPolls(rows: Record<string, unknown>[], caller: { id: string; role: string }) {
  const pollIds = rows.map(p => p.poll_id).filter(Boolean) as string[];
  if (pollIds.length === 0) return new Map<string, ReturnType<typeof buildPollView>>();

  const [pollsRes, optsRes, votesRes] = await Promise.all([
    fetch(`${S}/rest/v1/feed_polls?id=in.(${pollIds.join(',')})&select=id,post_id,message_id,question,poll_type,allow_vote_change,closes_at,closed_by,closed_at,created_by,created_at`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_poll_options?poll_id=in.(${pollIds.join(',')})&order=display_order.asc&select=id,poll_id,option_text,display_order`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_poll_votes?poll_id=in.(${pollIds.join(',')})&select=poll_id,option_id,user_id`, { headers: H() }),
  ]);
  const polls: PollRow[] = await pollsRes.json().catch(() => []);
  const opts: (PollOptionRow & { poll_id: string })[] = await optsRes.json().catch(() => []);
  const votes: (PollVoteRow & { poll_id: string })[] = await votesRes.json().catch(() => []);

  const optsByPoll = new Map<string, PollOptionRow[]>();
  (Array.isArray(opts) ? opts : []).forEach(o => { (optsByPoll.get(o.poll_id) || optsByPoll.set(o.poll_id, []).get(o.poll_id))!.push(o); });
  const votesByPoll = new Map<string, PollVoteRow[]>();
  (Array.isArray(votes) ? votes : []).forEach(v => { (votesByPoll.get(v.poll_id) || votesByPoll.set(v.poll_id, []).get(v.poll_id))!.push(v); });

  const out = new Map<string, ReturnType<typeof buildPollView>>();
  (Array.isArray(polls) ? polls : []).forEach(p => {
    out.set(p.id, buildPollView(p, optsByPoll.get(p.id) || [], votesByPoll.get(p.id) || [], caller));
  });
  return out;
}

// Cursor-paginated: the first page (no `before`) always includes every
// pinned post plus the newest `limit` unpinned posts; every subsequent
// "load more" page (`before=<created_at of the oldest post already
// shown>`) only pages back through unpinned posts, since pinned posts are
// already on screen from page one. Deleted posts are still returned (with
// `body` replaced by a fixed tombstone) rather than filtered out, so
// comment counts/threading and chronological ordering stay intact.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('group_id');
  if (!groupId) return NextResponse.json({ data: null, error: { message: 'group_id is required' } }, { status: 400 });

  const before = searchParams.get('before');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50);

  // feed_posts has no church_id of its own — verify the group itself
  // belongs to this caller's church before returning anything, otherwise
  // a guessed/leaked group_id from another church could be read here.
  const groupCheckRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${groupId}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
  const groupCheck = await groupCheckRes.json().catch(() => []);
  if (!groupCheck?.[0]) return NextResponse.json({ data: null, error: { message: 'Group not found' } }, { status: 404 });

  const beforeFilter = before ? `&created_at=lt.${encodeURIComponent(before)}` : '';
  const [pinnedRows, unpinnedRows] = await Promise.all([
    before
      ? Promise.resolve([])
      : fetch(`${S}/rest/v1/feed_posts?group_id=eq.${groupId}&pinned=eq.true&order=created_at.desc&select=${POST_SELECT}`, { headers: H() }).then(r => r.json()).catch(() => []),
    fetch(`${S}/rest/v1/feed_posts?group_id=eq.${groupId}&pinned=eq.false${beforeFilter}&order=created_at.desc&limit=${limit}&select=${POST_SELECT}`, { headers: H() }).then(r => r.json()).catch(() => []),
  ]);

  const rows: Record<string, unknown>[] = [...(Array.isArray(pinnedRows) ? pinnedRows : []), ...(Array.isArray(unpinnedRows) ? unpinnedRows : [])];
  const nextCursor = Array.isArray(unpinnedRows) && unpinnedRows.length === limit ? (unpinnedRows[unpinnedRows.length - 1] as { created_at: string }).created_at : null;

  if (rows.length === 0) return NextResponse.json({ data: { posts: [], next_cursor: null }, error: null });

  const ids = rows.map(p => p.id as string);
  const [commentsRes, acksRes, myAcksRes, reactsRes, pollsMap] = await Promise.all([
    fetch(`${S}/rest/v1/feed_comments?post_id=in.(${ids.join(',')})&select=post_id`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_acknowledgements?post_id=in.(${ids.join(',')})&select=post_id`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_acknowledgements?post_id=in.(${ids.join(',')})&user_id=eq.${user.id}&select=post_id`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_post_reactions?post_id=in.(${ids.join(',')})&select=post_id,user_id,emoji,users(full_name)`, { headers: H() }),
    attachPolls(rows, { id: user.id, role: user.role }),
  ]);
  const comments: { post_id: string }[] = await commentsRes.json().catch(() => []);
  const acks: { post_id: string }[] = await acksRes.json().catch(() => []);
  const myAcks: { post_id: string }[] = await myAcksRes.json().catch(() => []);
  const allReactions: { post_id: string; user_id: string; emoji: string; users: { full_name: string } | null }[] = await reactsRes.json().catch(() => []);
  const myAckSet = new Set((Array.isArray(myAcks) ? myAcks : []).map(a => a.post_id));

  const reactionsByPost: Record<string, { user_id: string; emoji: string; user_name: string }[]> = {};
  (Array.isArray(allReactions) ? allReactions : []).forEach(r => {
    (reactionsByPost[r.post_id] = reactionsByPost[r.post_id] || []).push({ user_id: r.user_id, emoji: r.emoji, user_name: r.users?.full_name || 'Someone' });
  });

  const posts_out = rows.map((p: Record<string, unknown>) => ({
    ...p,
    body: p.deleted_at ? DELETED_BODY : p.body,
    media_url: p.deleted_at ? null : p.media_url,
    comment_count: (Array.isArray(comments) ? comments : []).filter(c => c.post_id === p.id).length,
    ack_count: (Array.isArray(acks) ? acks : []).filter(a => a.post_id === p.id).length,
    acknowledged_by_me: myAckSet.has(p.id as string),
    reactions: reactionsByPost[p.id as string] || [],
    poll: p.poll_id ? (pollsMap.get(p.poll_id as string) || null) : null,
  }));

  return NextResponse.json({ data: { posts: posts_out, next_cursor: nextCursor }, error: null });
}

// Posting rights: leadership can post (and pin) anywhere. In the
// church-wide feed, every leader-tier role can post except `workforce`,
// which is read/comment/acknowledge-only there. In a department group,
// only that department's own head can post (besides leadership).
async function canPost(user: { id: string; role: string }, group: { type: string; department_id: string | null }): Promise<{ post: boolean; pin: boolean }> {
  if (LEADERSHIP.includes(user.role)) return { post: true, pin: group.type === 'church' };
  if (group.type === 'church') return { post: user.role !== 'workforce', pin: false };
  if (user.role === 'department_head') {
    const res = await fetch(`${S}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: H() });
    const data = await res.json().catch(() => []);
    return { post: data?.[0]?.department_id === group.department_id, pin: false };
  }
  return { post: false, pin: false };
}

type PollInput = { question: string; poll_type: 'single' | 'multiple'; options: string[]; allow_vote_change?: boolean; closes_at?: string | null };

function validatePollInput(poll: PollInput | undefined | null): string | null {
  if (!poll) return null;
  if (!poll.question?.trim()) return 'Poll question is required';
  if (poll.poll_type !== 'single' && poll.poll_type !== 'multiple') return 'poll_type must be "single" or "multiple"';
  const cleanOptions = (poll.options || []).map(o => (o || '').trim()).filter(Boolean);
  if (cleanOptions.length < 2) return 'A poll needs at least 2 options';
  if (cleanOptions.length > 20) return 'A poll can have at most 20 options';
  if (poll.closes_at && isNaN(new Date(poll.closes_at).getTime())) return 'closes_at is not a valid date';
  return null;
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { group_id, body, urgent, pinned, media_url, media_type, poll } = await req.json();
  const pollError = validatePollInput(poll);
  if (pollError) return NextResponse.json({ data: null, error: { message: pollError } }, { status: 400 });
  // A photo-only post (no caption) is allowed — text or media, at least one.
  // A poll always carries its own content (the question), so the body/media
  // requirement is waived when a poll is attached.
  if (!group_id || (!poll && !body?.trim() && !media_url)) {
    return NextResponse.json({ data: null, error: { message: 'group_id and a body, photo, or poll are required' } }, { status: 400 });
  }

  const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${group_id}&church_id=eq.${user.church_id}&select=id,type,department_id&limit=1`, { headers: H() });
  const groupData = await groupRes.json().catch(() => []);
  const group = groupData?.[0];
  if (!group) return NextResponse.json({ data: null, error: { message: 'Group not found' } }, { status: 404 });

  const perm = await canPost(user, group);
  if (!perm.post) return NextResponse.json({ data: null, error: { message: 'You do not have posting rights in this feed' } }, { status: 403 });

  const insertRes = await fetch(`${S}/rest/v1/feed_posts`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      group_id, author_id: user.id, author_name: user.name || 'Someone', author_role: user.role,
      body: (body || '').trim(), urgent: !!urgent, pinned: !!pinned && perm.pin,
      media_url: media_url || null, media_type: media_type || null,
    }),
  });
  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('[POST /api/feed/posts]', insertRes.status, err);
    return NextResponse.json({ data: null, error: { message: 'Failed to post' } }, { status: 502 });
  }
  const inserted = await insertRes.json();
  const post = Array.isArray(inserted) ? inserted[0] : inserted;

  let pollOut: ReturnType<typeof buildPollView> | null = null;
  if (poll && post?.id) {
    const pollInsertRes = await fetch(`${S}/rest/v1/feed_polls`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        post_id: post.id, question: poll.question.trim(), poll_type: poll.poll_type,
        allow_vote_change: poll.allow_vote_change !== false, closes_at: poll.closes_at || null, created_by: user.id,
      }),
    });
    if (!pollInsertRes.ok) {
      const err = await pollInsertRes.text().catch(() => '');
      console.error('[POST /api/feed/posts] poll insert failed', pollInsertRes.status, err);
      // Compensate: the post was already created but has no poll — remove it
      // rather than leaving a half-formed "poll post" with no poll behind it.
      await fetch(`${S}/rest/v1/feed_posts?id=eq.${post.id}`, { method: 'DELETE', headers: H() }).catch(() => {});
      return NextResponse.json({ data: null, error: { message: 'Failed to create poll' } }, { status: 502 });
    }
    const pollInserted = await pollInsertRes.json();
    const pollRow = Array.isArray(pollInserted) ? pollInserted[0] : pollInserted;

    const cleanOptions = (poll.options as string[]).map(o => o.trim()).filter(Boolean);
    const optsInsertRes = await fetch(`${S}/rest/v1/feed_poll_options`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify(cleanOptions.map((option_text, i) => ({ poll_id: pollRow.id, option_text, display_order: i }))),
    });
    const optsInserted = await optsInsertRes.json().catch(() => []);

    await fetch(`${S}/rest/v1/feed_posts?id=eq.${post.id}`, {
      method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ poll_id: pollRow.id }),
    });
    post.poll_id = pollRow.id;

    pollOut = buildPollView(pollRow, Array.isArray(optsInserted) ? optsInserted : [], [], { id: user.id, role: user.role });
  }

  // @group-tag mentions (e.g. @cell_leaders, @dept_heads, @choir) — a feed
  // post is already visible to its whole group, so unlike chat there's no
  // "not a participant" concern here; every resolved member is notifiable.
  // Scoping (own-branch vs church-wide) is enforced inside the resolver
  // itself, from the poster's own role/branch — never from anything
  // client-supplied.
  const { userIds: mentionedIds, matchedTags } = await extractGroupMentions(post?.body || '', {
    id: user.id, role: user.role, church_id: user.church_id, branch_id: user.branch_id,
  });
  const notifyIds = mentionedIds.filter(id => id !== user.id);
  if (notifyIds.length > 0 && post?.id) {
    const tagSuffix = matchedTags.length > 0 ? ` (@${matchedTags[0].tag})` : '';
    await notifyUsers(notifyIds, {
      type: 'pastoral',
      title: `${user.name || 'Someone'} mentioned you on Church Feed${tagSuffix}`,
      body: (post.body || pollOut?.question || '').slice(0, 120) as string,
      link: `/church-feed?post=${post.id}`,
    }, user.church_id);
  }

  return NextResponse.json({ data: { ...post, comment_count: 0, ack_count: 0, acknowledged_by_me: false, reactions: [], poll: pollOut }, error: null }, { status: 201 });
}
