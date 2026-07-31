export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Every thread the caller is a participant in, newest activity first, with
// the last message preview and an unread count computed from their own
// last_read_at watermark — no separate "unread" table needed.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const myRowsRes = await fetch(`${S}/rest/v1/chat_participants?user_id=eq.${user.id}&select=thread_id,last_read_at`, { headers: H() });
    const myRows = await myRowsRes.json().catch(() => []);
    const rows: { thread_id: string; last_read_at: string }[] = Array.isArray(myRows) ? myRows : [];
    if (rows.length === 0) return NextResponse.json({ data: { threads: [] }, error: null });

    const threadIds = rows.map(r => r.thread_id);
    const lastReadByThread: Record<string, string> = {};
    rows.forEach(r => { lastReadByThread[r.thread_id] = r.last_read_at; });

    const [threadsRes, participantsRes] = await Promise.all([
      fetch(`${S}/rest/v1/chat_threads?id=in.(${threadIds.join(',')})&select=id,type,name,created_at`, { headers: H() }),
      fetch(`${S}/rest/v1/chat_participants?thread_id=in.(${threadIds.join(',')})&select=thread_id,user_id,users(id,full_name,role)${EXCLUDE_DEMO_IDS.replace('&id=', '&user_id=')}`, { headers: H() }),
    ]);
    const threads = await threadsRes.json().catch(() => []);
    const participants = await participantsRes.json().catch(() => []);

    const participantsByThread: Record<string, { id: string; full_name: string; role: string }[]> = {};
    (Array.isArray(participants) ? participants : []).forEach((p: { thread_id: string; user_id: string; users: { id: string; full_name: string; role: string } | null }) => {
      if (!p.users) return;
      (participantsByThread[p.thread_id] = participantsByThread[p.thread_id] || []).push(p.users);
    });

    // Last message + total count per thread, in one query rather than N.
    const msgsRes = await fetch(`${S}/rest/v1/chat_messages?thread_id=in.(${threadIds.join(',')})&order=created_at.desc&select=id,thread_id,sender_id,sender_name,body,created_at`, { headers: H() });
    const msgs = await msgsRes.json().catch(() => []);
    const msgRows: { id: string; thread_id: string; sender_id: string; sender_name: string; body: string; created_at: string }[] = Array.isArray(msgs) ? msgs : [];

    const lastMsgByThread: Record<string, typeof msgRows[0]> = {};
    const unreadByThread: Record<string, number> = {};
    msgRows.forEach(m => {
      if (!lastMsgByThread[m.thread_id]) lastMsgByThread[m.thread_id] = m;
      const readAt = lastReadByThread[m.thread_id];
      if (m.sender_id !== user.id && (!readAt || new Date(m.created_at) > new Date(readAt))) {
        unreadByThread[m.thread_id] = (unreadByThread[m.thread_id] || 0) + 1;
      }
    });

    const result = (Array.isArray(threads) ? threads : []).map((t: { id: string; type: string; name: string | null; created_at: string }) => {
      const others = (participantsByThread[t.id] || []).filter(p => p.id !== user.id);
      const displayName = t.type === 'group' ? (t.name || 'Group chat') : (others[0]?.full_name || 'Unknown');
      return {
        id: t.id, type: t.type, name: displayName,
        participants: participantsByThread[t.id] || [],
        last_message: lastMsgByThread[t.id] ? { body: lastMsgByThread[t.id].body, sender_name: lastMsgByThread[t.id].sender_name, created_at: lastMsgByThread[t.id].created_at } : null,
        unread_count: unreadByThread[t.id] || 0,
      };
    }).sort((a, b) => {
      const at = a.last_message?.created_at || '1970-01-01';
      const bt = b.last_message?.created_at || '1970-01-01';
      return new Date(bt).getTime() - new Date(at).getTime();
    });

    return NextResponse.json({ data: { threads: result }, error: null });
  } catch (err) {
    console.error('[GET /api/chat/threads]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load chats' } }, { status: 500 });
  }
}

// Starts a direct chat (reuses an existing one between the same two people
// instead of duplicating it) or a group chat with a name + participant list.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { type, participant_id, name, participant_ids } = await req.json();

    if (type === 'direct') {
      if (!participant_id) return NextResponse.json({ data: null, error: { message: 'participant_id is required' } }, { status: 400 });

      // Look for an existing direct thread between exactly these two users.
      const mineRes = await fetch(`${S}/rest/v1/chat_participants?user_id=eq.${user.id}&select=thread_id`, { headers: H() });
      const mine = await mineRes.json().catch(() => []);
      const myThreadIds = (Array.isArray(mine) ? mine : []).map((r: { thread_id: string }) => r.thread_id);
      if (myThreadIds.length > 0) {
        const theirsRes = await fetch(`${S}/rest/v1/chat_participants?user_id=eq.${participant_id}&thread_id=in.(${myThreadIds.join(',')})&select=thread_id`, { headers: H() });
        const theirs = await theirsRes.json().catch(() => []);
        for (const row of (Array.isArray(theirs) ? theirs : [])) {
          const tRes = await fetch(`${S}/rest/v1/chat_threads?id=eq.${row.thread_id}&type=eq.direct&select=id`, { headers: H() });
          const tData = await tRes.json().catch(() => []);
          if (tData?.[0]?.id) return NextResponse.json({ data: { thread_id: tData[0].id, existing: true }, error: null });
        }
      }

      const insertRes = await fetch(`${S}/rest/v1/chat_threads`, {
        method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
        body: JSON.stringify({ type: 'direct', created_by: user.id, branch_id: user.branch_id || null }),
      });
      const inserted = await insertRes.json();
      const thread = Array.isArray(inserted) ? inserted[0] : inserted;
      if (!thread?.id) return NextResponse.json({ data: null, error: { message: 'Failed to start chat' } }, { status: 502 });

      await fetch(`${S}/rest/v1/chat_participants`, {
        method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify([{ thread_id: thread.id, user_id: user.id }, { thread_id: thread.id, user_id: participant_id }]),
      });

      return NextResponse.json({ data: { thread_id: thread.id, existing: false }, error: null }, { status: 201 });
    }

    if (type === 'group') {
      if (!name?.trim() || !Array.isArray(participant_ids) || participant_ids.length === 0) {
        return NextResponse.json({ data: null, error: { message: 'Group chats need a name and at least one other participant' } }, { status: 400 });
      }
      const insertRes = await fetch(`${S}/rest/v1/chat_threads`, {
        method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
        body: JSON.stringify({ type: 'group', name: name.trim(), created_by: user.id, branch_id: user.branch_id || null }),
      });
      const inserted = await insertRes.json();
      const thread = Array.isArray(inserted) ? inserted[0] : inserted;
      if (!thread?.id) return NextResponse.json({ data: null, error: { message: 'Failed to create group' } }, { status: 502 });

      const allIds = [...new Set([user.id, ...participant_ids])];
      await fetch(`${S}/rest/v1/chat_participants`, {
        method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(allIds.map(id => ({ thread_id: thread.id, user_id: id }))),
      });

      return NextResponse.json({ data: { thread_id: thread.id, existing: false }, error: null }, { status: 201 });
    }

    return NextResponse.json({ data: null, error: { message: 'type must be "direct" or "group"' } }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/chat/threads]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to start chat' } }, { status: 500 });
  }
}
