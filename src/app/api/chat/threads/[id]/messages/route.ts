export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { requireChatAccess } from '@/lib/plan-gate';
import { notifyUsers } from '@/lib/notify';
import { extractGroupMentions } from '@/lib/mention-groups';
import { buildPollView, attachPollViews, validatePollInput } from '@/lib/poll-analytics';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });
const DELETED_BODY = 'This message was deleted';
const MSG_SELECT = 'id,sender_id,sender_name,sender_role,body,mentioned_user_ids,created_at,deleted_at,deleted_by,media_url,media_type,poll_id';

async function getUser(req: Request) {
  return getAuthUser(req);
}

async function isParticipant(threadId: string, userId: string): Promise<boolean> {
  const res = await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&user_id=eq.${userId}&select=user_id&limit=1`, { headers: H() });
  const data = await res.json().catch(() => []);
  return Array.isArray(data) && data.length > 0;
}

// Three ways to call this:
//   - no params: initial load — the newest `limit` messages, chronological.
//   - ?since=<ts>: poll for anything new since the last message the client
//     already has (existing "keep the open conversation live" pattern).
//   - ?before=<ts>: "load older" — the `limit` messages immediately before
//     the oldest one currently on screen, for scrollback/infinite scroll.
// Deleted messages are still returned (body replaced by a fixed tombstone)
// rather than filtered out, so ordering and reply context stay intact.
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
    const before = searchParams.get('before');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);

    let messages: Record<string, unknown>[] = [];
    let nextCursor: string | null = null;

    if (since) {
      const res = await fetch(`${S}/rest/v1/chat_messages?thread_id=eq.${threadId}&order=created_at.asc&created_at=gt.${encodeURIComponent(since)}&select=${MSG_SELECT}`, { headers: H() });
      messages = await res.json().catch(() => []);
    } else if (before) {
      const res = await fetch(`${S}/rest/v1/chat_messages?thread_id=eq.${threadId}&order=created_at.desc&created_at=lt.${encodeURIComponent(before)}&limit=${limit}&select=${MSG_SELECT}`, { headers: H() });
      const rows: Record<string, unknown>[] = await res.json().catch(() => []);
      messages = Array.isArray(rows) ? [...rows].reverse() : [];
      if (Array.isArray(rows) && rows.length === limit) nextCursor = messages[0]?.created_at as string;
    } else {
      // Initial load — most recent `limit` messages, returned oldest-first.
      const res = await fetch(`${S}/rest/v1/chat_messages?thread_id=eq.${threadId}&order=created_at.desc&limit=${limit}&select=${MSG_SELECT}`, { headers: H() });
      const rows: Record<string, unknown>[] = await res.json().catch(() => []);
      messages = Array.isArray(rows) ? [...rows].reverse() : [];
      if (Array.isArray(rows) && rows.length === limit) nextCursor = messages[0]?.created_at as string;
    }

    const msgRows: { id: string }[] = Array.isArray(messages) ? (messages as { id: string }[]) : [];
    const msgIds = new Set(msgRows.map(m => m.id));
    const reactionsByMessage: Record<string, { user_id: string; emoji: string; user_name: string }[]> = {};
    if (msgIds.size > 0) {
      const reactsRes = await fetch(`${S}/rest/v1/chat_reactions?message_id=in.(${[...msgIds].join(',')})&select=message_id,user_id,emoji,users(full_name)`, { headers: H() });
      const allReactions = await reactsRes.json().catch(() => []);
      (Array.isArray(allReactions) ? allReactions : []).forEach((r: { message_id: string; user_id: string; emoji: string; users: { full_name: string } | null }) => {
        (reactionsByMessage[r.message_id] = reactionsByMessage[r.message_id] || []).push({ user_id: r.user_id, emoji: r.emoji, user_name: r.users?.full_name || 'Someone' });
      });
    }

    // Poll card-views — aggregate-only, gated the same way (and by the
    // same shared helper) as Church Feed's poll posts. Full per-voter
    // attribution never appears here; that's /api/chat/polls/[id]/results.
    const pollsMap = await attachPollViews(messages as { poll_id: string | null }[], { id: user.id, role: user.role });

    const result = msgRows.map((m: Record<string, unknown>) => ({
      ...m,
      body: m.deleted_at ? DELETED_BODY : m.body,
      media_url: m.deleted_at ? null : m.media_url,
      reactions: reactionsByMessage[m.id as string] || [],
      poll: m.poll_id ? (pollsMap.get(m.poll_id as string) || null) : null,
    }));

    return NextResponse.json({ data: { messages: result, next_cursor: nextCursor }, error: null });
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

    const { body: text, media_url, media_type, poll } = await req.json();
    const pollError = validatePollInput(poll);
    if (pollError) return NextResponse.json({ data: null, error: { message: pollError } }, { status: 400 });

    // Polls only make sense in a group conversation — a 1:1 direct thread
    // has nowhere for "response rate" or "non-responders" to mean anything
    // beyond the other single person, so it's out of scope by design.
    if (poll) {
      const threadRes = await fetch(`${S}/rest/v1/chat_threads?id=eq.${threadId}&select=type&limit=1`, { headers: H() });
      const thread = (await threadRes.json().catch(() => []))?.[0];
      if (!thread) return NextResponse.json({ data: null, error: { message: 'Chat not found' } }, { status: 404 });
      if (thread.type !== 'group') {
        return NextResponse.json({ data: null, error: { message: 'Polls are only available in group chats' } }, { status: 400 });
      }
    }

    // A poll always carries its own content (the question), so the
    // text/media requirement is waived when a poll is attached.
    if (!poll && !text?.trim() && !media_url) return NextResponse.json({ data: null, error: { message: 'Message body is required' } }, { status: 400 });

    // Resolve @mentions against this thread's own participant list (not a
    // church-wide user search) — a mention only makes sense for someone
    // already in the conversation.
    const participantsRes = await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&select=user_id,users(id,full_name)`, { headers: H() });
    const participantRows = await participantsRes.json().catch(() => []);
    const participants: { id: string; full_name: string }[] = (Array.isArray(participantRows) ? participantRows : [])
      .map((p: { users: { id: string; full_name: string } | null }) => p.users).filter(Boolean) as { id: string; full_name: string }[];

    const bodyText = (text || '').trim();
    const individualMentionIds = participants
      .filter(p => p.id !== user.id && new RegExp(`@${p.full_name.split(' ')[0]}\\b`, 'i').test(bodyText))
      .map(p => p.id);

    // @group-tag mentions (e.g. @cell_leaders, @dept_heads, @choir) are a
    // separate, distinct lookup from the @FirstName participant-matching
    // above — they resolve against the church/branch structure, not "must
    // already be in this thread". A resolved group member who ISN'T a
    // thread participant can't see the thread at all, so they're excluded
    // here rather than notified into a dead end — mentioned_user_ids stays
    // scoped to ids that are both resolved AND actual thread participants,
    // matching its existing "who got pinged (and can see it)" meaning.
    const participantIdSet = new Set(participants.map(p => p.id));
    const { userIds: groupMentionUserIds, matchedTags } = await extractGroupMentions(bodyText, {
      id: user.id, role: user.role, church_id: user.church_id, branch_id: user.branch_id,
    });
    const groupMentionParticipantIds = groupMentionUserIds.filter(id => id !== user.id && participantIdSet.has(id));

    const mentionedIds = [...new Set([...individualMentionIds, ...groupMentionParticipantIds])];

    const insertRes = await fetch(`${S}/rest/v1/chat_messages`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ thread_id: threadId, sender_id: user.id, sender_name: user.name, sender_role: user.role, body: bodyText, mentioned_user_ids: mentionedIds, media_url: media_url || null, media_type: media_type || null }),
    });
    const inserted = await insertRes.json();
    const message = Array.isArray(inserted) ? inserted[0] : inserted;
    if (!insertRes.ok || !message?.id) {
      return NextResponse.json({ data: null, error: { message: 'Failed to send message' } }, { status: 502 });
    }

    let pollOut: ReturnType<typeof buildPollView> | null = null;
    if (poll) {
      const pollInsertRes = await fetch(`${S}/rest/v1/feed_polls`, {
        method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          message_id: message.id, question: poll.question.trim(), poll_type: poll.poll_type,
          allow_vote_change: poll.allow_vote_change !== false, closes_at: poll.closes_at || null, created_by: user.id,
        }),
      });
      if (!pollInsertRes.ok) {
        const err = await pollInsertRes.text().catch(() => '');
        console.error('[POST /api/chat/threads/[id]/messages] poll insert failed', pollInsertRes.status, err);
        // Compensate: the message was already created but has no poll —
        // remove it rather than leaving a half-formed "poll message" behind.
        await fetch(`${S}/rest/v1/chat_messages?id=eq.${message.id}`, { method: 'DELETE', headers: H() }).catch(() => {});
        return NextResponse.json({ data: null, error: { message: 'Failed to create poll' } }, { status: 502 });
      }
      const pollInserted = await pollInsertRes.json();
      const pollRow = Array.isArray(pollInserted) ? pollInserted[0] : pollInserted;

      const cleanOptions = (poll.options as string[]).map((o: string) => o.trim()).filter(Boolean);
      const optsInsertRes = await fetch(`${S}/rest/v1/feed_poll_options`, {
        method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
        body: JSON.stringify(cleanOptions.map((option_text: string, i: number) => ({ poll_id: pollRow.id, option_text, display_order: i }))),
      });
      const optsInserted = await optsInsertRes.json().catch(() => []);

      await fetch(`${S}/rest/v1/chat_messages?id=eq.${message.id}`, {
        method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ poll_id: pollRow.id }),
      });
      message.poll_id = pollRow.id;

      pollOut = buildPollView(pollRow, Array.isArray(optsInserted) ? optsInserted : [], [], { id: user.id, role: user.role });
    }

    // Sending counts as having read your own thread up to now.
    await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&user_id=eq.${user.id}`, {
      method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ last_read_at: message.created_at }),
    });

    if (mentionedIds.length > 0) {
      const tagSuffix = matchedTags.length > 0 ? ` (@${matchedTags[0].tag})` : '';
      await notifyUsers(mentionedIds, {
        type: 'pastoral',
        title: `${user.name} mentioned you in chat${tagSuffix}`,
        body: bodyText.slice(0, 120),
        link: `/chat?thread=${threadId}`,
      }, user.church_id);
    }

    return NextResponse.json({ data: { ...message, reactions: [], poll: pollOut }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/chat/threads/[id]/messages]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to send message' } }, { status: 500 });
  }
}
