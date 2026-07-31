export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const res = await fetch(`${S}/rest/v1/feed_comments?post_id=eq.${id}&order=created_at.asc&select=id,author_id,author_name,body,created_at`, { headers: H() });
  const data = await res.json().catch(() => []);
  return NextResponse.json({ data: { comments: Array.isArray(data) ? data : [] }, error: null });
}

// Anyone who can see the post can comment — comments are how a "read
// only" workforce member in the church feed still gets a voice, and how
// department members respond to their HOD's posts.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ data: null, error: { message: 'Comment text is required' } }, { status: 400 });

  const insertRes = await fetch(`${S}/rest/v1/feed_comments`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ post_id: id, author_id: user.id, author_name: user.name || 'Someone', body: body.trim() }),
  });
  if (!insertRes.ok) return NextResponse.json({ data: null, error: { message: 'Failed to comment' } }, { status: 502 });
  const inserted = await insertRes.json();
  return NextResponse.json({ data: Array.isArray(inserted) ? inserted[0] : inserted, error: null }, { status: 201 });
}
