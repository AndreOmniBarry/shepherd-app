export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireChatAccess } from '@/lib/plan-gate';
import { notifyUsers } from '@/lib/notify';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

const LEADERSHIP = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Telegram-style soft delete — the sender can always delete their own
// message; leadership can delete any message within a thread that
// belongs to their own church (moderation), same permission shape as the
// feed delete routes. Never a hard DELETE — sets deleted_at/deleted_by so
// the GET route can render a tombstone in place, preserving ordering.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const chatBlocked = await requireChatAccess(user.church_id, user.role, user.id);
    if (chatBlocked) return chatBlocked;

    const { id: messageId } = await params;
    const msgRes = await fetch(`${S}/rest/v1/chat_messages?id=eq.${messageId}&select=id,thread_id,sender_id,deleted_at&limit=1`, { headers: H() });
    const msgData = await msgRes.json().catch(() => []);
    const message = msgData?.[0];
    if (!message) return NextResponse.json({ data: null, error: { message: 'Message not found' } }, { status: 404 });

    const isAuthor = message.sender_id === user.id;
    const isLeadership = LEADERSHIP.includes(user.role);
    if (!isAuthor && !isLeadership) {
      return NextResponse.json({ data: null, error: { message: 'You do not have permission to delete this message' } }, { status: 403 });
    }

    // chat_messages has no church_id of its own — verify the thread
    // belongs to this caller's church before allowing a delete, otherwise
    // a guessed/leaked message id from another church could be deleted
    // here. The author case is already same-church by construction (they
    // could only have sent it as a participant of their own thread), but
    // we verify unconditionally so the leadership branch can never cross
    // a tenant boundary.
    const threadRes = await fetch(`${S}/rest/v1/chat_threads?id=eq.${message.thread_id}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
    const threadData = await threadRes.json().catch(() => []);
    if (!threadData?.[0]) return NextResponse.json({ data: null, error: { message: 'Message not found' } }, { status: 404 });

    if (message.deleted_at) return NextResponse.json({ data: { deleted: true }, error: null });

    const patchRes = await fetch(`${S}/rest/v1/chat_messages?id=eq.${messageId}`, {
      method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ deleted_at: new Date().toISOString(), deleted_by: user.id }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.text().catch(() => '');
      console.error('[DELETE /api/chat/messages/[id]]', patchRes.status, err);
      return NextResponse.json({ data: null, error: { message: 'Failed to delete message' } }, { status: 502 });
    }

    if (!isAuthor && message.sender_id) {
      await notifyUsers([message.sender_id], {
        type: 'system',
        title: 'Your message was removed',
        body: `${user.name || 'A leader'} removed your message in a chat.`,
        link: `/chat?thread=${message.thread_id}`,
      }, user.church_id);
    }

    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (err) {
    console.error('[DELETE /api/chat/messages/[id]]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to delete message' } }, { status: 500 });
  }
}
