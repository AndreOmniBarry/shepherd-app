export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { notifyUsers } from '@/lib/notify';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

const LEADERSHIP = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Telegram-style soft delete: the row is never removed (that would break
// comment threading and ordering) — deleted_at/deleted_by are set and the
// GET route replaces `body` with a fixed tombstone for everyone.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  // feed_posts has no church_id of its own — verify the post's group
  // belongs to this caller's church before allowing a delete, otherwise a
  // guessed/leaked post id from another church could be deleted here.
  const postRes = await fetch(`${S}/rest/v1/feed_posts?id=eq.${id}&select=id,group_id,author_id,deleted_at&limit=1`, { headers: H() });
  const postData = await postRes.json().catch(() => []);
  const post = postData?.[0];
  if (!post) return NextResponse.json({ data: null, error: { message: 'Post not found' } }, { status: 404 });

  const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${post.group_id}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
  const groupData = await groupRes.json().catch(() => []);
  if (!groupData?.[0]) return NextResponse.json({ data: null, error: { message: 'Post not found' } }, { status: 404 });

  const isAuthor = post.author_id === user.id;
  const isLeadership = LEADERSHIP.includes(user.role);
  if (!isAuthor && !isLeadership) {
    return NextResponse.json({ data: null, error: { message: 'You do not have permission to delete this post' } }, { status: 403 });
  }

  if (post.deleted_at) return NextResponse.json({ data: { deleted: true }, error: null });

  const patchRes = await fetch(`${S}/rest/v1/feed_posts?id=eq.${id}`, {
    method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ deleted_at: new Date().toISOString(), deleted_by: user.id }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text().catch(() => '');
    console.error('[DELETE /api/feed/posts/[id]]', patchRes.status, err);
    return NextResponse.json({ data: null, error: { message: 'Failed to delete post' } }, { status: 502 });
  }

  if (!isAuthor && post.author_id) {
    await notifyUsers([post.author_id], {
      type: 'system',
      title: 'Your post was removed',
      body: `${user.name || 'A leader'} removed your post from Church Feed.`,
      link: '/church-feed',
    }, user.church_id);
  }

  return NextResponse.json({ data: { deleted: true }, error: null });
}
