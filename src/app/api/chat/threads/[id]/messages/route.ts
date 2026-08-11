export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireChatAccess } from '@/lib/plan-gate';
import { notifyUsers } from '@/lib/notify';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

async function isParticipant(threadId: string, userId: string): Promise<boolean> {
  const res = await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&user_id=eq.${userId}&select=user_id&limit=1`, { headers: H() });
  const data = await res.json().catch(() => []);
  return Array.isArray(data) && data.length > 0;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const chatBlocked = await requireChatAccess(user.church_id, user.role, user.id);
    if (chatBlocked) return chatBlocked;
    const { id: threadId } = await params;
    if (!(await isParticipant(threadId, user.id))) {
      return NextResponse.json({ data: null, error: { message: 'Not a participant in this chat' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');
    const sinceFilter = since ? `&created_at=gt.${encodeURIComponent(since)}` : '';
    const limitParam = since ? '' : '&limit=50';

    const [msgsRes, reactsRes] = await Promise.all([
      fetch(`${S}/rest/v1/chat_messages?thread_id=eq.${threadId}&order=created_at.asc${sinceFilter}${limitParam}&select=id,sender_id,sender_name,sender_role,body,mentioned_user_ids,created_at`, { headers: H() }),
      fetch(`${S}/rest/v1/chat_reactions?select=message_id,user_id,emoji,users(full_name)`, { headers: H() }),
    ]);
    const messages = await msgsRes.json().catch(() => []);
    const allReactions = await reactsRes.json().catch(() => []);

    const msgRows: { id: string }[] = Array.isArray(messages) ? messages : [];
    const msgIds = new Set(msgRows.map(m => m.id));
    const reactionsByMessage: Record<string, { user_id: string; emoji: string; user_name: string }[]> = {};
    (Array.isArray(allReactions) ? allReactions : []).forEach((r: { message_id: string; user_id: string; emoji: string; users: { full_name: string } | null }) => {
      if (!msgIds.has(r.message_id)) return;
      (reactionsByMessage[r.message_id] = reactionsByMessage[r.message_id] || []).push({ user_id: r.user_id, emoji: r.emoji, user_name: r.users?.full_name || 'Someone' });
    });

    const result = msgRows.map((m: Record<string, unknown>) => ({ ...m, reactions: reactionsByMessage[m.id as string] || [] }));

    return NextResponse.json({ data: { messages: result }, error: null });
  } catch (err) {
    console.error('[GET /api/chat/threads/[id]/messages]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load messages' } }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const chatBlocked = await requireChatAccess(user.church_id, user.role, user.id);
    if (chatBlocked) return chatBlocked;
    const { id: threadId } = await params;
    if (!(await isParticipant(threadId, user.id))) {
      return NextResponse.json({ data: null, error: { message: 'Not a participant in this chat' } }, { status: 403 });
    }

    const { body: text } = await req.json();
    if (!text?.trim()) return NextResponse.json({ data: null, error: { message: 'Message body is required' } }, { status: 400 });

    // Resolve @mentions against this thread's own participant list (not a
    // church-wide user search) — a mention only makes sense for someone
    // already in the conversation.
    const participantsRes = await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&select=user_id,users(id,full_name)`, { headers: H() });
    const participantRows = await participantsRes.json().catch(() => []);
    const participants: { id: string; full_name: string }[] = (Array.isArray(participantRows) ? participantRows : [])
      .map((p: { users: { id: string; full_name: string } | null }) => p.users).filter(Boolean) as { id: string; full_name: string }[];

    const mentionedIds = participants
      .filter(p => p.id !== user.id && new RegExp(`@${p.full_name.split(' ')[0]}\\b`, 'i').test(text))
      .map(p => p.id);

    const insertRes = await fetch(`${S}/rest/v1/chat_messages`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ thread_id: threadId, sender_id: user.id, sender_name: user.name, sender_role: user.role, body: text.trim(), mentioned_user_ids: mentionedIds }),
    });
    const inserted = await insertRes.json();
    const message = Array.isArray(inserted) ? inserted[0] : inserted;
    if (!insertRes.ok || !message?.id) {
      return NextResponse.json({ data: null, error: { message: 'Failed to send message' } }, { status: 502 });
    }

    // Sending counts as having read your own thread up to now.
    await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&user_id=eq.${user.id}`, {
      method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ last_read_at: message.created_at }),
    });

    if (mentionedIds.length > 0) {
      await notifyUsers(mentionedIds, {
        type: 'pastoral',
        title: `${user.name} mentioned you in chat`,
        body: text.trim().slice(0, 120),
        link: `/chat?thread=${threadId}`,
      }, user.church_id);
    }

    return NextResponse.json({ data: { ...message, reactions: [] }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/chat/threads/[id]/messages]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to send message' } }, { status: 500 });
  }
}
