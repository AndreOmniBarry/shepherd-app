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

// One reaction per user per message. Sending the same emoji again removes
// it (toggle off); sending a different emoji replaces it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { id: messageId } = await params;
    const { emoji } = await req.json();
    if (!emoji) return NextResponse.json({ data: null, error: { message: 'emoji is required' } }, { status: 400 });

    const existingRes = await fetch(`${S}/rest/v1/chat_reactions?message_id=eq.${messageId}&user_id=eq.${user.id}&select=emoji`, { headers: H() });
    const existing = await existingRes.json().catch(() => []);
    const current = Array.isArray(existing) && existing[0] ? existing[0].emoji : null;

    if (current === emoji) {
      await fetch(`${S}/rest/v1/chat_reactions?message_id=eq.${messageId}&user_id=eq.${user.id}`, { method: 'DELETE', headers: H() });
      return NextResponse.json({ data: { removed: true }, error: null });
    }

    await fetch(`${S}/rest/v1/chat_reactions`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ message_id: messageId, user_id: user.id, emoji }),
    });
    return NextResponse.json({ data: { removed: false, emoji }, error: null });
  } catch (err) {
    console.error('[POST /api/chat/messages/[id]/react]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to react' } }, { status: 500 });
  }
}
