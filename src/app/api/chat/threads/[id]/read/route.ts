export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { id: threadId } = await params;

    const res = await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&user_id=eq.${user.id}`, {
      method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ last_read_at: new Date().toISOString() }),
    });
    if (!res.ok) return NextResponse.json({ data: null, error: { message: 'Failed to mark as read' } }, { status: 502 });

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (err) {
    console.error('[POST /api/chat/threads/[id]/read]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to mark as read' } }, { status: 500 });
  }
}
