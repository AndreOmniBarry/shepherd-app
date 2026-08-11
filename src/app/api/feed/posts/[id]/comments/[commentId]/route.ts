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

// Telegram-style soft delete — see feed/posts/[id]/route.ts DELETE for the
// same pattern applied to comments.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { id: postId, commentId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const commentRes = await fetch(`${S}/rest/v1/feed_comments?id=eq.${commentId}&post_id=eq.${postId}&select=id,post_id,author_id,deleted_at&limit=1`, { headers: H() });
  const commentData = await commentRes.json().catch(() => []);
  const comment = commentData?.[0];
  if (!comment) return NextResponse.json({ data: null, error: { message: 'Comment not found' } }, { status: 404 });

  // feed_comments has no church_id of its own — verify the parent post's
  // group belongs to this caller's church before allowing a delete,
  // otherwise a guessed/leaked comment id from another church could be
  // deleted here.
  const postRes = await fetch(`${S}/rest/v1/feed_posts?id=eq.${postId}&select=group_id&limit=1`, { headers: H() });
  const postData = await postRes.json().catch(() => []);
  const groupId = postData?.[0]?.group_id;
  if (!groupId) return NextResponse.json({ data: null, error: { message: 'Comment not found' } }, { status: 404 });
  const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${groupId}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
  const groupData = await groupRes.json().catch(() => []);
  if (!groupData?.[0]) return NextResponse.json({ data: null, error: { message: 'Comment not found' } }, { status: 404 });

  const isAuthor = comment.author_id === user.id;
  const isLeadership = LEADERSHIP.includes(user.role);
  if (!isAuthor && !isLeadership) {
    return NextResponse.json({ data: null, error: { message: 'You do not have permission to delete this comment' } }, { status: 403 });
  }

  if (comment.deleted_at) return NextResponse.json({ data: { deleted: true }, error: null });

  const patchRes = await fetch(`${S}/rest/v1/feed_comments?id=eq.${commentId}`, {
    method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ deleted_at: new Date().toISOString(), deleted_by: user.id }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text().catch(() => '');
    console.error('[DELETE /api/feed/posts/[id]/comments/[commentId]]', patchRes.status, err);
    return NextResponse.json({ data: null, error: { message: 'Failed to delete comment' } }, { status: 502 });
  }

  if (!isAuthor && comment.author_id) {
    await notifyUsers([comment.author_id], {
      type: 'system',
      title: 'Your comment was removed',
      body: `${user.name || 'A leader'} removed your comment on Church Feed.`,
      link: '/church-feed',
    }, user.church_id);
  }

  return NextResponse.json({ data: { deleted: true }, error: null });
}
