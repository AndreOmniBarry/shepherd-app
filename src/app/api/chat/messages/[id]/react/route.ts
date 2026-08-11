export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
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

    // Verify the message exists and the caller is a participant of the
    // thread it belongs to — otherwise any authenticated user could react
    // to any message_id by guessing/enumerating ids, including messages in
    // threads (and churches) they were never added to.
    const msgRes = await fetch(`${S}/rest/v1/chat_messages?id=eq.${messageId}&select=thread_id&limit=1`, { headers: H() });
    const msgRow = (await msgRes.json().catch(() => []))?.[0];
    if (!msgRow?.thread_id) return NextResponse.json({ data: null, error: { message: 'Message not found' } }, { status: 404 });
    const participantRes = await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${msgRow.thread_id}&user_id=eq.${user.id}&select=user_id&limit=1`, { headers: H() });
    const participantRows = await participantRes.json().catch(() => []);
    if (!Array.isArray(participantRows) || participantRows.length === 0) {
      return NextResponse.json({ data: null, error: { message: 'Not a participant in this chat' } }, { status: 403 });
    }

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
