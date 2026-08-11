export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { extractGroupMentions } from '@/lib/mention-groups';
import { notifyUsers } from '@/lib/notify';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

const LEADERSHIP = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];
const DELETED_BODY = 'This post was deleted';
const POST_SELECT = 'id,author_id,author_name,author_role,body,urgent,pinned,created_at,deleted_at,deleted_by,media_url,media_type';

async function getUser(req: Request) {
  return getAuthUser(req);
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
  const [commentsRes, acksRes, myAcksRes, reactsRes] = await Promise.all([
    fetch(`${S}/rest/v1/feed_comments?post_id=in.(${ids.join(',')})&select=post_id`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_acknowledgements?post_id=in.(${ids.join(',')})&select=post_id`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_acknowledgements?post_id=in.(${ids.join(',')})&user_id=eq.${user.id}&select=post_id`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_post_reactions?post_id=in.(${ids.join(',')})&select=post_id,user_id,emoji,users(full_name)`, { headers: H() }),
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

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { group_id, body, urgent, pinned, media_url, media_type } = await req.json();
  // A photo-only post (no caption) is allowed — text or media, at least one.
  if (!group_id || (!body?.trim() && !media_url)) {
    return NextResponse.json({ data: null, error: { message: 'group_id and a body or photo are required' } }, { status: 400 });
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
      body: (post.body || '').slice(0, 120),
      link: `/church-feed?post=${post.id}`,
    }, user.church_id);
  }

  return NextResponse.json({ data: { ...post, comment_count: 0, ack_count: 0, acknowledged_by_me: false, reactions: [] }, error: null }, { status: 201 });
}
