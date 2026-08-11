export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Facebook-style multi-emoji reaction, modeled directly on
// /api/chat/messages/[id]/react — one reaction per user per post; sending
// the same emoji again removes it, a different emoji replaces it. This is
// in addition to (not a replacement for) feed_acknowledgements, which
// stays the distinct "who's actually seen this" signal.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { id: postId } = await params;
    const { emoji } = await req.json();
    if (!emoji) return NextResponse.json({ data: null, error: { message: 'emoji is required' } }, { status: 400 });

    // feed_posts/feed_post_reactions have no church_id of their own —
    // verify the post's group belongs to this caller's church before
    // reacting to it, otherwise a guessed/leaked post id from another
    // church could be reacted to here.
    const postRes = await fetch(`${S}/rest/v1/feed_posts?id=eq.${postId}&select=group_id&limit=1`, { headers: H() });
    const postData = await postRes.json().catch(() => []);
    const groupId = postData?.[0]?.group_id;
    if (!groupId) return NextResponse.json({ data: null, error: { message: 'Post not found' } }, { status: 404 });
    const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${groupId}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
    const groupData = await groupRes.json().catch(() => []);
    if (!groupData?.[0]) return NextResponse.json({ data: null, error: { message: 'Post not found' } }, { status: 404 });

    const existingRes = await fetch(`${S}/rest/v1/feed_post_reactions?post_id=eq.${postId}&user_id=eq.${user.id}&select=emoji`, { headers: H() });
    const existing = await existingRes.json().catch(() => []);
    const current = Array.isArray(existing) && existing[0] ? existing[0].emoji : null;

    if (current === emoji) {
      await fetch(`${S}/rest/v1/feed_post_reactions?post_id=eq.${postId}&user_id=eq.${user.id}`, { method: 'DELETE', headers: H() });
      return NextResponse.json({ data: { removed: true }, error: null });
    }

    await fetch(`${S}/rest/v1/feed_post_reactions`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ post_id: postId, user_id: user.id, emoji }),
    });
    return NextResponse.json({ data: { removed: false, emoji }, error: null });
  } catch (err) {
    console.error('[POST /api/feed/posts/[id]/react]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to react' } }, { status: 500 });
  }
}
