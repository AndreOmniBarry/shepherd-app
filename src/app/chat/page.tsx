'use client';
import { useTheme } from '@/hooks/useTheme';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MyAccountButton from '@/components/MyAccountButton';
import Icon from '@/components/Icon';
import { SkeletonRow } from '@/components/Skeleton';
import LoadingScreen from '@/components/LoadingScreen';
import { playNotificationSound, triggerHaptic } from '@/lib/notify-feedback';
import { rolePortal } from '@/lib/role-portal';
import ThemeToggle from '@/components/ThemeToggle';
import PollCard from '@/components/PollCard';
import PollComposerFields from '@/components/PollComposerFields';
import PollAnalyticsPanel from '@/components/PollAnalyticsPanel';
import { emptyPollDraft, type PollDraft, type PollView } from '@/types/poll';

type Thread = {
  id: string; type: 'direct' | 'group'; name: string;
  participants: { id: string; full_name: string; role: string }[];
  last_message: { body: string; sender_name: string; created_at: string } | null;
  unread_count: number;
};
type Reaction = { user_id: string; emoji: string; user_name: string };
type Message = {
  id: string; sender_id: string; sender_name: string; sender_role: string; body: string; mentioned_user_ids: string[]; created_at: string; reactions: Reaction[];
  deleted_at: string | null; deleted_by: string | null; media_url: string | null; media_type: string | null; poll: PollView | null;
};
type Person = { id: string; full_name: string; role: string };
type MentionGroup = { tag: string; label: string; kind: string };

const LEADERSHIP = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];
const REACTION_EMOJI = ['👍', '❤️', '😂', '🙏', '🎉'];
const AVATAR_HUES = ['#534AB7', '#1D9E75', '#D85A30', '#BA7517', '#2D6FD4', '#B0459E'];

function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
function avatarColor(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_HUES[sum % AVATAR_HUES.length];
}
function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', background: avatarColor(name || 'Someone') }}>
      {initials(name)}
    </div>
  );
}

function renderBody(body: string, mine: boolean): React.ReactNode {
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) => part.startsWith('@') ? (
    <span key={i} style={{ fontWeight: 700, color: mine ? '#fff' : '#A89FFF', background: mine ? 'rgba(255,255,255,0.18)' : 'rgba(168,159,255,0.15)', borderRadius: 4, padding: '0 3px' }}>{part}</span>
  ) : part);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ChatPage() {
  const router = useRouter();
  const {dark, setDark} = useTheme();
  const [homePath, setHomePath] = useState('/dashboard');
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [myRole, setMyRole] = useState('');
  const isLeader = LEADERSHIP.includes(myRole);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [composerBody, setComposerBody] = useState('');
  const [composerMedia, setComposerMedia] = useState<{ url: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionGroups, setMentionGroups] = useState<MentionGroup[]>([]);
  const composerFileRef = useRef<HTMLInputElement>(null);
  const [pollMode, setPollMode] = useState(false);
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft());
  const [analyticsPollId, setAnalyticsPollId] = useState<string | null>(null);

  const [showNewChat, setShowNewChat] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [newChatMode, setNewChatMode] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [groupParticipants, setGroupParticipants] = useState<string[]>([]);
  const [newChatError, setNewChatError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<string>('');

  // Typing indicators (chat/DMs only, never feeds) — ephemeral Supabase
  // Realtime Broadcast on a per-thread channel, layered on top of the
  // existing polling message delivery, never replacing it. Nothing here
  // is persisted to any table.
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; at: number }>>({});
  const typingWsRef = useRef<WebSocket | null>(null);
  const typingRefCounter = useRef(1);
  const lastTypingBroadcastRef = useRef(0);

  const t = {
    bg: dark ? '#080614' : '#F0EFF8', card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC', input: dark ? '#0F0C20' : '#F7F6FF',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    coral: dark ? '#F0876B' : '#D85A30', coralBg: dark ? '#2E1610' : '#FAECE7',
    navBg: dark ? '#0A0618' : '#FFFFFF', navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
  };

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      if (!data) { router.push('/login'); return; }
      setHomePath(rolePortal(data.role)); setMyId(data.id); setMyRole(data.role); setMyName(data.name || '');
    }).catch(() => router.push('/login'));
  }, [router]);

  const loadThreads = useCallback(() => {
    fetch('/api/chat/threads', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      setThreads(data?.threads || []);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadThreads(); }, [loadThreads]);

  // @group-tag options for mention autocomplete (@cell_leaders, @dept_heads,
  // @choir, …) — same catalog regardless of which thread is open, since
  // it's resolved from the caller's own role/branch, not the thread.
  useEffect(() => {
    if (!myId) return;
    fetch('/api/mentions/groups', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      setMentionGroups(data?.groups || []);
    }).catch(() => {});
  }, [myId]);
  // Thread list (previews + unread counts) refreshes on a slower cadence
  // than the open conversation itself.
  useEffect(() => { const iv = setInterval(loadThreads, 8000); return () => clearInterval(iv); }, [loadThreads]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('thread');
    if (requested) setActiveThreadId(requested);
  }, []);

  const loadMessages = useCallback((initial: boolean) => {
    if (!activeThreadId) return;
    const since = initial ? '' : (lastMessageTimeRef.current ? `&since=${encodeURIComponent(lastMessageTimeRef.current)}` : '');
    fetch(`/api/chat/threads/${activeThreadId}/messages?x=1${since}`, { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      const incoming: Message[] = data?.messages || [];
      if (initial) setOldestCursor(data?.next_cursor || null);
      if (incoming.length === 0) return;
      if (initial) setMessages(incoming);
      else {
        let hasNewFromOther = false;
        setMessages(prev => {
          const fresh = incoming.filter(m => !prev.some(p => p.id === m.id));
          hasNewFromOther = fresh.some(m => m.sender_id !== myId);
          return [...prev, ...fresh];
        });
        if (hasNewFromOther) { playNotificationSound(); triggerHaptic(); }
      }
      lastMessageTimeRef.current = incoming[incoming.length - 1].created_at;
    });
  }, [activeThreadId, myId]);

  useEffect(() => {
    if (!activeThreadId) return;
    setMessages([]); lastMessageTimeRef.current = ''; setOldestCursor(null);
    setPollMode(false); setPollDraft(emptyPollDraft());
    loadMessages(true);
    fetch(`/api/chat/threads/${activeThreadId}/read`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setThreads(prev => prev.map(th => th.id === activeThreadId ? { ...th, unread_count: 0 } : th));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    const iv = setInterval(() => loadMessages(false), 3500);
    return () => clearInterval(iv);
  }, [activeThreadId, loadMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Ephemeral typing-indicator channel — one Supabase Realtime Broadcast
  // websocket per open thread, following the same connection pattern as
  // NotificationBell's postgres_changes socket (raw phx_join over the
  // project's realtime websocket endpoint). This is layered on top of the
  // existing since/before polling for actual message delivery, and never
  // touches it — closing/reopening this socket can never drop a message.
  useEffect(() => {
    setTypingUsers({});
    typingWsRef.current = null;
    if (!activeThreadId || !myId) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const topic = `realtime:chat-thread-${activeThreadId}`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    try {
      const wsUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + supabaseKey + '&vsn=1.0.0';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws?.send(JSON.stringify({
          topic,
          event: 'phx_join',
          payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' } } },
          ref: '1',
        }));
        // Phoenix channels drop a socket that goes quiet for too long —
        // keep it alive for the whole time this thread stays open.
        heartbeat = setInterval(() => {
          ws?.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }));
        }, 25000);
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.topic === topic && data.event === 'broadcast' && data.payload?.event === 'typing') {
            const { user_id, name } = data.payload.payload || {};
            if (!user_id || user_id === myId) return;
            setTypingUsers(prev => ({ ...prev, [user_id]: { name: name || 'Someone', at: Date.now() } }));
          }
        } catch { /* ignore malformed frames */ }
      };

      ws.onerror = () => {}; // Silent fail — typing indicators are a nice-to-have, never load-bearing
    } catch { /* Realtime unavailable — composer still works, just no live indicator */ }

    typingWsRef.current = ws;
    return () => {
      if (heartbeat) clearInterval(heartbeat);
      ws?.close();
      typingWsRef.current = null;
    };
  }, [activeThreadId, myId]);

  // Auto-clear a typing entry a few seconds after its last event, so a
  // participant who closed their tab (or just stopped) doesn't stay
  // pinned as "typing…" forever.
  useEffect(() => {
    if (Object.keys(typingUsers).length === 0) return;
    const iv = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        let changed = false;
        const next: typeof prev = {};
        Object.entries(prev).forEach(([id, v]) => {
          if (now - v.at < 3000) next[id] = v; else changed = true;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [typingUsers]);

  // Broadcasts a typing event on this thread's channel, throttled to at
  // most once every ~1.5s of active typing (debounced away entirely once
  // the user stops — there's no explicit "stopped typing" event, the
  // receiver side just lets the indicator expire on its own).
  function broadcastTyping() {
    const ws = typingWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeThreadId) return;
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current < 1500) return;
    lastTypingBroadcastRef.current = now;
    ws.send(JSON.stringify({
      topic: `realtime:chat-thread-${activeThreadId}`,
      event: 'broadcast',
      payload: { type: 'broadcast', event: 'typing', payload: { user_id: myId, name: myName || 'Someone' } },
      ref: String(typingRefCounter.current++),
    }));
  }

  async function loadOlderMessages() {
    if (!oldestCursor || loadingOlder || !activeThreadId) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/chat/threads/${activeThreadId}/messages?before=${encodeURIComponent(oldestCursor)}`, { credentials: 'include' });
      const json = await res.json();
      const older: Message[] = json.data?.messages || [];
      setMessages(prev => [...older, ...prev]);
      setOldestCursor(json.data?.next_cursor || null);
    } finally { setLoadingOlder(false); }
  }

  const activeThread = threads.find(th => th.id === activeThreadId);

  function handleComposerChange(v: string) {
    setComposerBody(v);
    const m = v.match(/@(\w*)$/);
    setMentionQuery(m ? m[1] : null);
    if (v.trim()) broadcastTyping();
  }

  function insertMention(name: string) {
    setComposerBody(prev => prev.replace(/@\w*$/, `@${name.split(' ')[0]} `));
    setMentionQuery(null);
  }

  function insertGroupMention(tag: string) {
    setComposerBody(prev => prev.replace(/@\w*$/, `@${tag} `));
    setMentionQuery(null);
  }

  async function uploadMedia(file: File): Promise<{ url: string; type: string } | null> {
    if (file.size > 5 * 1024 * 1024) return null;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file); form.append('context', 'chat');
      const res = await fetch('/api/media/upload', { method: 'POST', credentials: 'include', body: form });
      const json = await res.json();
      if (!res.ok) return null;
      return { url: json.data.url, type: json.data.media_type };
    } catch { return null; }
    finally { setUploading(false); }
  }

  function validPollDraft(): boolean {
    return !!pollDraft.question.trim() && pollDraft.options.filter(o => o.trim()).length >= 2;
  }

  async function sendMessage() {
    if (!activeThreadId) return;
    if (pollMode) { if (!validPollDraft()) return; } else if (!composerBody.trim() && !composerMedia) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/threads/${activeThreadId}/messages`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: composerBody.trim(), media_url: composerMedia?.url, media_type: composerMedia?.type,
          poll: pollMode ? {
            question: pollDraft.question.trim(), poll_type: pollDraft.poll_type, options: pollDraft.options,
            allow_vote_change: pollDraft.allow_vote_change, closes_at: pollDraft.closes_at ? new Date(pollDraft.closes_at).toISOString() : null,
          } : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setMessages(prev => [...prev, json.data]);
        lastMessageTimeRef.current = json.data.created_at;
        setComposerBody(''); setMentionQuery(null); setComposerMedia(null);
        setPollMode(false); setPollDraft(emptyPollDraft());
        loadThreads();
      }
    } finally { setSending(false); }
  }

  async function voteOnPoll(messageId: string, pollId: string, optionIds: string[]) {
    const res = await fetch(`/api/chat/polls/${pollId}/vote`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ option_ids: optionIds }),
    });
    const json = await res.json();
    if (res.ok && json.data?.poll) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, poll: json.data.poll } : m));
    }
  }

  async function deleteMessage(messageId: string) {
    if (!confirm('Delete this message? Everyone in the chat will see it was removed.')) return;
    const res = await fetch(`/api/chat/messages/${messageId}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted_at: new Date().toISOString(), body: 'This message was deleted', media_url: null } : m));
  }

  async function react(messageId: string, emoji: string) {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const already = m.reactions.find(r => r.user_id === myId);
      let reactions = m.reactions.filter(r => r.user_id !== myId);
      if (!already || already.emoji !== emoji) reactions = [...reactions, { user_id: myId, emoji, user_name: 'You' }];
      return { ...m, reactions };
    }));
    await fetch(`/api/chat/messages/${messageId}/react`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
    }).catch(() => {});
  }

  function openNewChat() {
    setShowNewChat(true); setNewChatError(''); setGroupName(''); setGroupParticipants([]);
    if (people.length === 0) {
      fetch('/api/church-center/people', { credentials: 'include' }).then(r => r.json()).then(({ data }) => setPeople(data?.people || []));
    }
  }

  async function startDirectChat(personId: string) {
    const res = await fetch('/api/chat/threads', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'direct', participant_id: personId }),
    });
    const json = await res.json();
    if (res.ok && json.data?.thread_id) {
      setShowNewChat(false); loadThreads(); setActiveThreadId(json.data.thread_id);
    } else setNewChatError(json.error?.message || 'Failed to start chat');
  }

  async function createGroupChat() {
    if (!groupName.trim() || groupParticipants.length === 0) { setNewChatError('Name the group and pick at least one person.'); return; }
    const res = await fetch('/api/chat/threads', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'group', name: groupName.trim(), participant_ids: groupParticipants }),
    });
    const json = await res.json();
    if (res.ok && json.data?.thread_id) {
      setShowNewChat(false); loadThreads(); setActiveThreadId(json.data.thread_id);
    } else setNewChatError(json.error?.message || 'Failed to create group');
  }

  const glass: React.CSSProperties = { background: 'var(--glass-bg)', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(160%)', backdropFilter: 'blur(var(--glass-blur)) saturate(160%)', border: '0.5px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)' };
  const totalUnread = threads.reduce((a, th) => a + th.unread_count, 0);
  const mentionCandidates = mentionQuery !== null && activeThread ? activeThread.participants.filter(p => p.id !== myId && p.full_name.toLowerCase().includes(mentionQuery.toLowerCase())) : [];
  const mentionGroupCandidates = mentionQuery !== null
    ? mentionGroups.filter(g => g.tag.includes(mentionQuery.toLowerCase()) || g.label.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  if (loading) return <LoadingScreen dark={dark} label="Loading your chats…" />;

  return (
    <div data-theme={dark ? 'dark' : 'light'} className="shep-page-enter" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: dark ? `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.12), transparent 45%), ${t.bg}` : `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.06), transparent 45%), ${t.bg}`, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: t.navBg, WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)', borderBottom: `0.5px solid ${t.navBorder}`, boxShadow: dark ? '0 2px 10px rgba(0,0,0,0.35)' : '0 2px 10px rgba(31,25,71,0.10)', padding: isMobile ? 'calc(10px + env(safe-area-inset-top)) 14px 10px' : '0 20px', height: isMobile ? undefined : 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, minWidth: 0 }}>
          <button onClick={() => router.push(homePath)} title="Back to dashboard"
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            style={{ background: t.purpleBg, border: 'none', borderRadius: 'var(--radius-sm)', width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, flexShrink: 0, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--motion-fast) var(--ease-spring)' }}>
            <Icon name="ti-arrow-left" size={isMobile ? 13 : 15} />
          </button>
          {!isMobile && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
              <div style={{ fontSize: 10, color: t.muted }}>Chat</div>
            </div>
          )}
          {isMobile && <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Chat</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 8, flexShrink: 0 }}>
          <NotificationBell dark={dark} compact={isMobile} /><MyAccountButton dark={dark} compact={isMobile} />
          <ThemeToggle dark={dark} setDark={setDark} border={t.border} compact={isMobile} />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Thread list — on mobile this is a full-screen view of its own,
            hidden once a chat is opened, instead of squeezing beside the
            conversation pane at a fixed 280px. */}
        <div style={{ width: isMobile ? '100%' : 280, borderRight: `0.5px solid ${t.border}`, display: (isMobile && activeThreadId) ? 'none' : 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              Chats
              {totalUnread > 0 && <span style={{ background: t.coral, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 7px', minWidth: 16, textAlign: 'center' }}>{totalUnread}</span>}
            </div>
            <button onClick={openNewChat}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', width: 26, height: 26, fontSize: 15, cursor: 'pointer', transition: 'transform var(--motion-fast) var(--ease-spring)' }}>+</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {loading ? (
              <div style={{ padding: '0 8px' }}>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</div>
            ) : threads.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: t.muted, fontSize: 12 }}>No chats yet — start one with the + button.</div>
            ) : threads.map(th => (
              <div key={th.id} onClick={() => setActiveThreadId(th.id)}
                onMouseEnter={e => { if (activeThreadId !== th.id) e.currentTarget.style.background = dark ? 'rgba(168,159,255,0.06)' : 'rgba(83,74,183,0.04)'; }}
                onMouseLeave={e => { if (activeThreadId !== th.id) e.currentTarget.style.background = 'transparent'; }}
                style={{ padding: '10px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: activeThreadId === th.id ? t.purpleBg : 'transparent', transition: 'background var(--motion-fast) var(--ease-out-expo)', marginBottom: 2, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Avatar name={th.type === 'group' ? th.name : (th.participants.find(p => p.id !== myId)?.full_name || th.name)} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: th.unread_count > 0 ? 700 : 500, color: t.text, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {th.type === 'group' && <Icon name="ti-users" size={12} />}{th.name}
                    </div>
                    {th.last_message && <span style={{ fontSize: 10, color: t.muted, flexShrink: 0 }}>{timeAgo(th.last_message.created_at)}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <div style={{ fontSize: 11, color: th.unread_count > 0 ? t.sub : t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>
                      {th.last_message ? `${th.last_message.sender_name.split(' ')[0]}: ${th.last_message.body}` : 'No messages yet'}
                    </div>
                    {th.unread_count > 0 && <span style={{ background: t.purple, color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 6px', flexShrink: 0 }}>{th.unread_count}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversation */}
        <div style={{ flex: 1, display: (isMobile && !activeThreadId) ? 'none' : 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!activeThread ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 13 }}>Select a chat, or start a new one.</div>
          ) : (
            <>
              <div style={{ padding: '12px 18px', borderBottom: `0.5px solid ${t.border}`, fontSize: 13, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                {isMobile && (
                  <button onClick={() => setActiveThreadId('')} style={{ background: t.purpleBg, border: 'none', borderRadius: 'var(--radius-sm)', width: 26, height: 26, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 2 }}>
                    <Icon name="ti-arrow-left" size={14} />
                  </button>
                )}
                {activeThread.type === 'group' && <Icon name="ti-users" size={14} />}{activeThread.name}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {oldestCursor && (
                  <button onClick={loadOlderMessages} disabled={loadingOlder}
                    style={{ alignSelf: 'center', background: 'transparent', border: `0.5px solid ${t.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 11, color: t.purple, cursor: loadingOlder ? 'wait' : 'pointer', fontWeight: 600, marginBottom: 4 }}>
                    {loadingOlder ? 'Loading…' : 'Load older messages'}
                  </button>
                )}
                {messages.map(m => {
                  const mine = m.sender_id === myId;
                  const isDeleted = !!m.deleted_at;
                  const canDelete = !isDeleted && (mine || isLeader);
                  return (
                    <div key={m.id} className="shep-tab-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                      {!mine && activeThread.type === 'group' && <div style={{ fontSize: 10, color: t.muted, marginBottom: 2, marginLeft: 4 }}>{m.sender_name}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '85%' }}>
                        {canDelete && !mine && (
                          <button onClick={() => deleteMessage(m.id)} title="Delete message"
                            style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', padding: 2, display: 'flex', order: 2 }}>
                            <Icon name="ti-trash" size={12} />
                          </button>
                        )}
                        <div style={{ ...glass, maxWidth: '100%', padding: '9px 13px', borderRadius: mine ? '14px 14px 3px 14px' : '14px 14px 14px 3px', background: mine ? t.purple : 'var(--glass-bg)', color: mine ? '#fff' : t.text, fontStyle: isDeleted ? 'italic' : 'normal', opacity: isDeleted ? 0.75 : 1 }}>
                          {m.media_url && !isDeleted && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.media_url} alt="Attachment" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, display: 'block', marginBottom: m.body?.trim() ? 6 : 0 }} />
                          )}
                          {(!m.media_url || m.body?.trim()) && (
                            <div style={{ fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{isDeleted ? m.body : renderBody(m.body, mine)}</div>
                          )}
                        </div>
                        {canDelete && mine && (
                          <button onClick={() => deleteMessage(m.id)} title="Delete message"
                            style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', padding: 2, display: 'flex' }}>
                            <Icon name="ti-trash" size={12} />
                          </button>
                        )}
                      </div>
                      {m.poll && !isDeleted && (
                        <div style={{ maxWidth: '85%', width: 300 }}>
                          <PollCard poll={m.poll} dark={dark} myId={myId}
                            onVote={optionIds => voteOnPoll(m.id, m.poll!.id, optionIds)}
                            onOpenAnalytics={() => setAnalyticsPollId(m.poll!.id)} />
                        </div>
                      )}
                      {!isDeleted && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: t.muted }}>{timeAgo(m.created_at)}</span>
                          {m.reactions.length > 0 && (
                            <div style={{ display: 'flex', gap: 2 }}>
                              {Object.entries(m.reactions.reduce((acc: Record<string, number>, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})).map(([emoji, count]) => (
                                <span key={emoji} onClick={() => react(m.id, emoji)} style={{ fontSize: 11, background: t.purpleBg, borderRadius: 10, padding: '1px 6px', cursor: 'pointer' }}>{emoji}{count > 1 ? ` ${count}` : ''}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 1 }}>
                            {REACTION_EMOJI.map(e => (
                              <span key={e} onClick={() => react(m.id, e)} title={`React ${e}`}
                                style={{ fontSize: 12, opacity: 0.35, cursor: 'pointer', transition: 'opacity var(--motion-fast) var(--ease-out-expo), transform var(--motion-fast) var(--ease-spring)' }}
                                onMouseEnter={ev => { ev.currentTarget.style.opacity = '1'; ev.currentTarget.style.transform = 'scale(1.3)'; }}
                                onMouseLeave={ev => { ev.currentTarget.style.opacity = '0.35'; ev.currentTarget.style.transform = 'scale(1)'; }}>{e}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              {Object.keys(typingUsers).length > 0 && (
                <div style={{ padding: '0 18px 6px', fontSize: 11, color: t.muted, fontStyle: 'italic' }}>
                  {(() => {
                    const names = Object.values(typingUsers).map(v => v.name.split(' ')[0]);
                    return `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} typing…`;
                  })()}
                </div>
              )}
              <div style={{ padding: 14, borderTop: `0.5px solid ${t.border}`, position: 'relative' }}>
                {(mentionGroupCandidates.length > 0 || mentionCandidates.length > 0) && (
                  <div style={{ ...glass, position: 'absolute', bottom: '100%', left: 14, marginBottom: 6, borderRadius: 'var(--radius-sm)', overflow: 'hidden', minWidth: 180 }}>
                    {mentionGroupCandidates.map(g => (
                      <div key={`g-${g.tag}`} onClick={() => insertGroupMention(g.tag)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, color: t.teal, fontWeight: 600, cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = t.tealBg; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <Icon name="ti-users" size={12} />@{g.tag}
                        <span style={{ fontSize: 10, color: t.muted, fontWeight: 400 }}>{g.label}</span>
                      </div>
                    ))}
                    {mentionCandidates.map(p => (
                      <div key={p.id} onClick={() => insertMention(p.full_name)}
                        style={{ padding: '7px 12px', fontSize: 12, color: t.text, cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = t.purpleBg; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        @{p.full_name}
                      </div>
                    ))}
                  </div>
                )}
                {composerMedia && (
                  <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={composerMedia.url} alt="Attached" style={{ maxWidth: 140, maxHeight: 100, borderRadius: 8, display: 'block' }} />
                    <button onClick={() => setComposerMedia(null)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="ti-x" size={10} />
                    </button>
                  </div>
                )}
                {pollMode && <PollComposerFields draft={pollDraft} onChange={setPollDraft} dark={dark} />}
                <div style={{ display: 'flex', gap: 8, marginTop: pollMode ? 8 : 0 }}>
                  <input ref={composerFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                    onChange={async e => { const f = e.target.files?.[0]; if (f) { const m = await uploadMedia(f); if (m) setComposerMedia(m); } e.target.value = ''; }} />
                  <button onClick={() => composerFileRef.current?.click()} disabled={uploading} title="Attach photo"
                    style={{ background: 'transparent', border: `0.5px solid ${t.border}`, borderRadius: 'var(--radius-sm)', width: 38, flexShrink: 0, cursor: uploading ? 'wait' : 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="ti-photo" size={15} />
                  </button>
                  {/* Polls only make sense in a group conversation — hidden
                      entirely for a 1:1 direct thread, out of scope by design. */}
                  {activeThread.type === 'group' && (
                    <button onClick={() => { setPollMode(v => !v); if (pollMode) setPollDraft(emptyPollDraft()); }} title="Create a poll"
                      style={{ background: pollMode ? t.purpleBg : 'transparent', border: `0.5px solid ${pollMode ? t.purple : t.border}`, borderRadius: 'var(--radius-sm)', width: 38, flexShrink: 0, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="ti-chart-bar" size={15} />
                    </button>
                  )}
                  <input value={composerBody} onChange={e => handleComposerChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={pollMode ? 'Optional note above the poll…' : 'Message… use @ to mention someone in this chat'}
                    style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={sendMessage} disabled={sending || (pollMode ? !validPollDraft() : (!composerBody.trim() && !composerMedia))}
                    style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (pollMode ? validPollDraft() : (composerBody.trim() || composerMedia)) ? 1 : 0.5 }}>
                    {pollMode ? 'Post poll' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowNewChat(false)}>
          <div onClick={e => e.stopPropagation()} className="shep-pop-enter" style={{ ...glass, borderRadius: 'var(--radius-md)', padding: 20, width: 340, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button onClick={() => setNewChatMode('direct')} style={{ flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: newChatMode === 'direct' ? t.purple : t.purpleBg, color: newChatMode === 'direct' ? '#fff' : t.purple }}>Direct message</button>
              <button onClick={() => setNewChatMode('group')} style={{ flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: newChatMode === 'group' ? t.purple : t.purpleBg, color: newChatMode === 'group' ? '#fff' : t.purple }}>Group chat</button>
            </div>
            {newChatMode === 'group' && (
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name"
                style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text, marginBottom: 10, outline: 'none' }} />
            )}
            {newChatError && <div style={{ color: t.coral, fontSize: 11, marginBottom: 8 }}>{newChatError}</div>}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {people.map(p => {
                const selected = groupParticipants.includes(p.id);
                return (
                  <div key={p.id} onClick={() => newChatMode === 'direct' ? startDirectChat(p.id) : setGroupParticipants(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderRadius: 8, cursor: 'pointer', background: selected ? t.purpleBg : 'transparent' }}
                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = dark ? 'rgba(168,159,255,0.06)' : 'rgba(83,74,183,0.04)'; }}
                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ fontSize: 12, color: t.text }}>{p.full_name} <span style={{ color: t.muted, textTransform: 'capitalize' }}>· {p.role.replace(/_/g, ' ')}</span></span>
                    {newChatMode === 'group' && selected && <Icon name="ti-check" size={13} />}
                  </div>
                );
              })}
            </div>
            {newChatMode === 'group' && (
              <button onClick={createGroupChat} style={{ marginTop: 10, background: t.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Create group ({groupParticipants.length} selected)</button>
            )}
          </div>
        </div>
      )}
      {analyticsPollId && (
        <PollAnalyticsPanel pollId={analyticsPollId} kind="chat" dark={dark} onClose={() => setAnalyticsPollId(null)} />
      )}
    </div>
  );
}
