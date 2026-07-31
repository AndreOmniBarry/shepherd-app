'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MyAccountButton from '@/components/MyAccountButton';
import Icon from '@/components/Icon';
import { SkeletonRow } from '@/components/Skeleton';
import { rolePortal } from '@/lib/role-portal';

type Thread = {
  id: string; type: 'direct' | 'group'; name: string;
  participants: { id: string; full_name: string; role: string }[];
  last_message: { body: string; sender_name: string; created_at: string } | null;
  unread_count: number;
};
type Reaction = { user_id: string; emoji: string; user_name: string };
type Message = { id: string; sender_id: string; sender_name: string; sender_role: string; body: string; mentioned_user_ids: string[]; created_at: string; reactions: Reaction[] };
type Person = { id: string; full_name: string; role: string };

const REACTION_EMOJI = ['👍', '❤️', '😂', '🙏', '🎉'];

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
  const [dark, setDark] = useState(false);
  const [homePath, setHomePath] = useState('/dashboard');
  const [myId, setMyId] = useState('');
  const [loading, setLoading] = useState(true);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const [composerBody, setComposerBody] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const [showNewChat, setShowNewChat] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [newChatMode, setNewChatMode] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [groupParticipants, setGroupParticipants] = useState<string[]>([]);
  const [newChatError, setNewChatError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<string>('');

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
      setHomePath(rolePortal(data.role)); setMyId(data.id);
    }).catch(() => router.push('/login'));
  }, [router]);

  const loadThreads = useCallback(() => {
    fetch('/api/chat/threads', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      setThreads(data?.threads || []);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadThreads(); }, [loadThreads]);
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
      if (incoming.length === 0) return;
      if (initial) setMessages(incoming);
      else setMessages(prev => [...prev, ...incoming.filter(m => !prev.some(p => p.id === m.id))]);
      lastMessageTimeRef.current = incoming[incoming.length - 1].created_at;
    });
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    setMessages([]); lastMessageTimeRef.current = '';
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

  const activeThread = threads.find(th => th.id === activeThreadId);

  function handleComposerChange(v: string) {
    setComposerBody(v);
    const m = v.match(/@(\w*)$/);
    setMentionQuery(m ? m[1] : null);
  }

  function insertMention(name: string) {
    setComposerBody(prev => prev.replace(/@\w*$/, `@${name.split(' ')[0]} `));
    setMentionQuery(null);
  }

  async function sendMessage() {
    if (!composerBody.trim() || !activeThreadId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/threads/${activeThreadId}/messages`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: composerBody.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setMessages(prev => [...prev, json.data]);
        lastMessageTimeRef.current = json.data.created_at;
        setComposerBody(''); setMentionQuery(null);
        loadThreads();
      }
    } finally { setSending(false); }
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

  return (
    <div data-theme={dark ? 'dark' : 'light'} className="shep-page-enter" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: dark ? `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.12), transparent 45%), ${t.bg}` : `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.06), transparent 45%), ${t.bg}`, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: t.navBg, WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)', borderBottom: `0.5px solid ${t.navBorder}`, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push(homePath)} title="Back to dashboard"
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            style={{ background: t.purpleBg, border: 'none', borderRadius: 'var(--radius-sm)', width: 30, height: 30, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--motion-fast) var(--ease-spring)' }}>
            <Icon name="ti-arrow-left" size={15} />
          </button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
            <div style={{ fontSize: 10, color: t.muted }}>Chat</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotificationBell dark={dark} /><MyAccountButton dark={dark} />
          <div onClick={() => setDark(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.muted, fontSize: 14 }}>
            {dark ? '☀' : '◑'}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Thread list */}
        <div style={{ width: 280, borderRight: `0.5px solid ${t.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
                style={{ padding: '10px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: activeThreadId === th.id ? t.purpleBg : 'transparent', transition: 'background var(--motion-fast) var(--ease-out-expo)', marginBottom: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: th.unread_count > 0 ? 700 : 500, color: t.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {th.type === 'group' && <Icon name="ti-users" size={12} />}{th.name}
                  </div>
                  {th.last_message && <span style={{ fontSize: 10, color: t.muted, flexShrink: 0 }}>{timeAgo(th.last_message.created_at)}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <div style={{ fontSize: 11, color: th.unread_count > 0 ? t.sub : t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                    {th.last_message ? `${th.last_message.sender_name.split(' ')[0]}: ${th.last_message.body}` : 'No messages yet'}
                  </div>
                  {th.unread_count > 0 && <span style={{ background: t.purple, color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 6px', flexShrink: 0 }}>{th.unread_count}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversation */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!activeThread ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: 13 }}>Select a chat, or start a new one.</div>
          ) : (
            <>
              <div style={{ padding: '12px 18px', borderBottom: `0.5px solid ${t.border}`, fontSize: 13, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                {activeThread.type === 'group' && <Icon name="ti-users" size={14} />}{activeThread.name}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(m => {
                  const mine = m.sender_id === myId;
                  return (
                    <div key={m.id} className="shep-tab-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                      {!mine && activeThread.type === 'group' && <div style={{ fontSize: 10, color: t.muted, marginBottom: 2, marginLeft: 4 }}>{m.sender_name}</div>}
                      <div style={{ ...glass, maxWidth: '70%', padding: '9px 13px', borderRadius: mine ? '14px 14px 3px 14px' : '14px 14px 14px 3px', background: mine ? t.purple : 'var(--glass-bg)', color: mine ? '#fff' : t.text }}>
                        <div style={{ fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                      </div>
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
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ padding: 14, borderTop: `0.5px solid ${t.border}`, position: 'relative' }}>
                {mentionCandidates.length > 0 && (
                  <div style={{ ...glass, position: 'absolute', bottom: '100%', left: 14, marginBottom: 6, borderRadius: 'var(--radius-sm)', overflow: 'hidden', minWidth: 160 }}>
                    {mentionCandidates.map(p => (
                      <div key={p.id} onClick={() => insertMention(p.full_name)}
                        style={{ padding: '7px 12px', fontSize: 12, color: t.text, cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = t.purpleBg; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        @{p.full_name}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={composerBody} onChange={e => handleComposerChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Message… use @ to mention someone in this chat"
                    style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, background: t.input, color: t.text, outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={sendMessage} disabled={sending || !composerBody.trim()}
                    style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: composerBody.trim() ? 1 : 0.5 }}>Send</button>
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
    </div>
  );
}
