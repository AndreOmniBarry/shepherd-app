export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { extractGroupMentions } from '@/lib/mention-groups';
import { notifyUsers } from '@/lib/notify';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });
const DELETED_BODY = 'This comment was deleted';

async function getUser(req: Request) {
  return getAuthUser(req);
}

// feed_posts/feed_comments have no church_id of their own — verify the
// post's group belongs to this caller's church before reading/writing its
// comments, otherwise a guessed/leaked post id from another church could
// be read from or commented on here.
async function postInOwnChurch(postId: string, churchId: string | null | undefined): Promise<boolean> {
  const postRes = await fetch(`${S}/rest/v1/feed_posts?id=eq.${postId}&select=group_id&limit=1`, { headers: H() });
  const postData = await postRes.json().catch(() => []);
  const groupId = postData?.[0]?.group_id;
  if (!groupId) return false;
  const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${groupId}&church_id=eq.${churchId}&select=id&limit=1`, { headers: H() });
  const groupData = await groupRes.json().catch(() => []);
  return !!groupData?.[0];
}

// Returned flat (with parent_comment_id) rather than pre-nested — the
// frontend groups top-level comments and their one level of replies
// client-side, which is less code/risk than restructuring this route's
// existing flat shape.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  if (!(await postInOwnChurch(id, user.church_id))) return NextResponse.json({ data: null, error: { message: 'Post not found' } }, { status: 404 });
  const res = await fetch(`${S}/rest/v1/feed_comments?post_id=eq.${id}&order=created_at.asc&select=id,author_id,author_name,body,created_at,deleted_at,deleted_by,parent_comment_id`, { headers: H() });
  const data = await res.json().catch(() => []);
  const rows = Array.isArray(data) ? data : [];
  const comments = rows.map((c: Record<string, unknown>) => ({ ...c, body: c.deleted_at ? DELETED_BODY : c.body }));
  return NextResponse.json({ data: { comments }, error: null });
}

// Anyone who can see the post can comment — comments are how a "read
// only" workforce member in the church feed still gets a voice, and how
// department members respond to their HOD's posts.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  if (!(await postInOwnChurch(id, user.church_id))) return NextResponse.json({ data: null, error: { message: 'Post not found' } }, { status: 404 });
  const { body, parent_comment_id } = await req.json();
  if (!body?.trim()) return NextResponse.json({ data: null, error: { message: 'Comment text is required' } }, { status: 400 });

  // A reply must point at a comment that actually belongs to this same
  // post — otherwise a client could stitch together a reply thread across
  // unrelated posts.
  let parentId: string | null = null;
  if (parent_comment_id) {
    const parentRes = await fetch(`${S}/rest/v1/feed_comments?id=eq.${parent_comment_id}&post_id=eq.${id}&select=id&limit=1`, { headers: H() });
    const parentData = await parentRes.json().catch(() => []);
    if (!parentData?.[0]) return NextResponse.json({ data: null, error: { message: 'Parent comment not found on this post' } }, { status: 400 });
    parentId = parent_comment_id;
  }

  const insertRes = await fetch(`${S}/rest/v1/feed_comments`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ post_id: id, author_id: user.id, author_name: user.name || 'Someone', body: body.trim(), parent_comment_id: parentId }),
  });
  if (!insertRes.ok) return NextResponse.json({ data: null, error: { message: 'Failed to comment' } }, { status: 502 });
  const inserted = await insertRes.json();
  const comment = Array.isArray(inserted) ? inserted[0] : inserted;

  // @group-tag mentions in a comment — same resolver/scoping as posts.
  const { userIds: mentionedIds, matchedTags } = await extractGroupMentions(comment?.body || '', {
    id: user.id, role: user.role, church_id: user.church_id, branch_id: user.branch_id,
  });
  const notifyIds = mentionedIds.filter(uid => uid !== user.id);
  if (notifyIds.length > 0) {
    const tagSuffix = matchedTags.length > 0 ? ` (@${matchedTags[0].tag})` : '';
    await notifyUsers(notifyIds, {
      type: 'pastoral',
      title: `${user.name || 'Someone'} mentioned you in a Church Feed comment${tagSuffix}`,
      body: (comment.body || '').slice(0, 120),
      link: `/church-feed?post=${id}`,
    }, user.church_id);
  }

  return NextResponse.json({ data: comment, error: null }, { status: 201 });
}
