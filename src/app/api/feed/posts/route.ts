export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

const LEADERSHIP = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
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

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('group_id');
  if (!groupId) return NextResponse.json({ data: null, error: { message: 'group_id is required' } }, { status: 400 });

  const postsRes = await fetch(`${S}/rest/v1/feed_posts?group_id=eq.${groupId}&order=pinned.desc,created_at.desc&limit=50&select=id,author_id,author_name,author_role,body,urgent,pinned,created_at`, { headers: H() });
  const posts = await postsRes.json().catch(() => []);
  const rows: { id: string }[] = Array.isArray(posts) ? posts : [];
  if (rows.length === 0) return NextResponse.json({ data: { posts: [] }, error: null });

  const ids = rows.map(p => p.id);
  const [commentsRes, acksRes, myAcksRes] = await Promise.all([
    fetch(`${S}/rest/v1/feed_comments?post_id=in.(${ids.join(',')})&select=post_id`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_acknowledgements?post_id=in.(${ids.join(',')})&select=post_id`, { headers: H() }),
    fetch(`${S}/rest/v1/feed_acknowledgements?post_id=in.(${ids.join(',')})&user_id=eq.${user.id}&select=post_id`, { headers: H() }),
  ]);
  const comments: { post_id: string }[] = await commentsRes.json().catch(() => []);
  const acks: { post_id: string }[] = await acksRes.json().catch(() => []);
  const myAcks: { post_id: string }[] = await myAcksRes.json().catch(() => []);
  const myAckSet = new Set((Array.isArray(myAcks) ? myAcks : []).map(a => a.post_id));

  const posts_out = rows.map((p: Record<string, unknown>) => ({
    ...p,
    comment_count: (Array.isArray(comments) ? comments : []).filter(c => c.post_id === p.id).length,
    ack_count: (Array.isArray(acks) ? acks : []).filter(a => a.post_id === p.id).length,
    acknowledged_by_me: myAckSet.has(p.id as string),
  }));

  return NextResponse.json({ data: { posts: posts_out }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { group_id, body, urgent, pinned } = await req.json();
  if (!group_id || !body?.trim()) return NextResponse.json({ data: null, error: { message: 'group_id and body are required' } }, { status: 400 });

  const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${group_id}&select=id,type,department_id&limit=1`, { headers: H() });
  const groupData = await groupRes.json().catch(() => []);
  const group = groupData?.[0];
  if (!group) return NextResponse.json({ data: null, error: { message: 'Group not found' } }, { status: 404 });

  const perm = await canPost(user, group);
  if (!perm.post) return NextResponse.json({ data: null, error: { message: 'You do not have posting rights in this feed' } }, { status: 403 });

  const insertRes = await fetch(`${S}/rest/v1/feed_posts`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      group_id, author_id: user.id, author_name: user.name || 'Someone', author_role: user.role,
      body: body.trim(), urgent: !!urgent, pinned: !!pinned && perm.pin,
    }),
  });
  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('[POST /api/feed/posts]', insertRes.status, err);
    return NextResponse.json({ data: null, error: { message: 'Failed to post' } }, { status: 502 });
  }
  const inserted = await insertRes.json();
  return NextResponse.json({ data: Array.isArray(inserted) ? inserted[0] : inserted, error: null }, { status: 201 });
}
