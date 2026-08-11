export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Toggles a simple "acknowledged" mark — the feed's equivalent of a
// reaction, deliberately just one plain signal (not a set of emoji) so an
// urgent post from the pastor has a clear "who's actually seen this" count.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  // feed_posts/feed_acknowledgements have no church_id of their own —
  // verify the post's group belongs to this caller's church before
  // acknowledging it, otherwise a guessed/leaked post id from another
  // church could be acknowledged here.
  const postRes = await fetch(`${S}/rest/v1/feed_posts?id=eq.${id}&select=group_id&limit=1`, { headers: H() });
  const postData = await postRes.json().catch(() => []);
  const groupId = postData?.[0]?.group_id;
  if (!groupId) return NextResponse.json({ data: null, error: { message: 'Post not found' } }, { status: 404 });
  const groupCheckRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${groupId}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
  const groupCheck = await groupCheckRes.json().catch(() => []);
  if (!groupCheck?.[0]) return NextResponse.json({ data: null, error: { message: 'Post not found' } }, { status: 404 });

  const existingRes = await fetch(`${S}/rest/v1/feed_acknowledgements?post_id=eq.${id}&user_id=eq.${user.id}&select=post_id`, { headers: H() });
  const existing = await existingRes.json().catch(() => []);
  const already = Array.isArray(existing) && existing.length > 0;

  if (already) {
    await fetch(`${S}/rest/v1/feed_acknowledgements?post_id=eq.${id}&user_id=eq.${user.id}`, { method: 'DELETE', headers: H() });
    return NextResponse.json({ data: { acknowledged: false }, error: null });
  }
  await fetch(`${S}/rest/v1/feed_acknowledgements`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ post_id: id, user_id: user.id }),
  });
  return NextResponse.json({ data: { acknowledged: true }, error: null });
}
