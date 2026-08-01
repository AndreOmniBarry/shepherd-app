'use client';
import { useTheme } from '@/hooks/useTheme';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MyAccountButton from '@/components/MyAccountButton';
import Icon from '@/components/Icon';
import { SkeletonCard } from '@/components/Skeleton';
import LoadingScreen from '@/components/LoadingScreen';
import ChatNavButton from '@/components/ChatNavButton';
import { rolePortal } from '@/lib/role-portal';
import ThemeToggle from '@/components/ThemeToggle';

type Group = { id: string; type: 'church' | 'department'; name: string; department_id: string | null; departments?: { name: string } | null };
type Post = { id: string; author_id: string; author_name: string; author_role: string; body: string; urgent: boolean; pinned: boolean; created_at: string; comment_count: number; ack_count: number; acknowledged_by_me: boolean };
type Comment = { id: string; author_name: string; body: string; created_at: string };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChurchFeedPage() {
  const router = useRouter();
  const {dark, setDark} = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [homePath, setHomePath] = useState('/dashboard');
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsError, setGroupsError] = useState('');
  const [activeGroupId, setActiveGroupId] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBody, setComposerBody] = useState('');
  const [composerUrgent, setComposerUrgent] = useState(false);
  const [composerPinned, setComposerPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentDraft, setCommentDraft] = useState('');

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');

  const t = {
    bg: dark ? '#080614' : '#F0EFF8', card: dark ? '#13102A' : '#FFFFFF',
    border: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
    text: dark ? '#E8E5FF' : '#1A1040', sub: dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted: dark ? 'rgba(232,229,255,0.35)' : '#9990CC', input: dark ? '#0F0C20' : '#F7F6FF',
    purple: dark ? '#A89FFF' : '#534AB7', purpleBg: dark ? '#1A1A2E' : '#EEEDFE',
    teal: dark ? '#2DD4AA' : '#1D9E75', tealBg: dark ? '#0D2620' : '#E1F5EE',
    coral: dark ? '#F0876B' : '#D85A30', coralBg: dark ? '#2E1610' : '#FAECE7',
    amber: dark ? '#FCD34D' : '#BA7517', amberBg: dark ? '#1F1A00' : '#FAEEDA',
    navBg: dark ? '#0A0618' : '#FFFFFF', navBorder: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.12)',
  };

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      if (!data) { router.push('/login'); return; }
      setHomePath(rolePortal(data.role)); setUserRole(data.role);
    }).catch(() => router.push('/login'));
  }, [router]);

  const loadGroups = useCallback(() => {
    setLoading(true); setGroupsError('');
    fetch('/api/feed/groups', { credentials: 'include' }).then(r => r.json().then(json => ({ ok: r.ok, json }))).then(({ ok, json }) => {
      if (!ok) { setGroupsError(json?.error?.message || 'Could not load Church Feed groups.'); setGroups([]); return; }
      const list: Group[] = json?.data?.groups || [];
      setGroups(list);
      setActiveGroupId(prev => list.some(g => g.id === prev) ? prev : (list[0]?.id || ''));
    }).catch(() => setGroupsError('Network error — could not load Church Feed groups.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  const loadPosts = useCallback(() => {
    if (!activeGroupId) return;
    setPostsLoading(true);
    fetch(`/api/feed/posts?group_id=${activeGroupId}`, { credentials: 'include' }).then(r => r.json()).then(({ data }) => setPosts(data?.posts || [])).finally(() => setPostsLoading(false));
  }, [activeGroupId]);
  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function submitPost() {
    if (!composerBody.trim()) return;
    setPosting(true); setPostError('');
    try {
      const res = await fetch('/api/feed/posts', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: activeGroupId, body: composerBody.trim(), urgent: composerUrgent, pinned: composerPinned }),
      });
      const json = await res.json();
      if (!res.ok) { setPostError(json.error?.message || 'Failed to post.'); return; }
      setComposerBody(''); setComposerUrgent(false); setComposerPinned(false); setComposerOpen(false);
      loadPosts();
    } finally { setPosting(false); }
  }

  async function toggleAck(postId: string) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, acknowledged_by_me: !p.acknowledged_by_me, ack_count: p.ack_count + (p.acknowledged_by_me ? -1 : 1) } : p));
    await fetch(`/api/feed/posts/${postId}/acknowledge`, { method: 'POST', credentials: 'include' }).catch(() => {});
  }

  function toggleExpand(postId: string) {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    if (!comments[postId]) {
      fetch(`/api/feed/posts/${postId}/comments`, { credentials: 'include' }).then(r => r.json()).then(({ data }) => setComments(prev => ({ ...prev, [postId]: data?.comments || [] })));
    }
  }

  async function submitComment(postId: string) {
    if (!commentDraft.trim()) return;
    const body = commentDraft.trim();
    setCommentDraft('');
    const res = await fetch(`/api/feed/posts/${postId}/comments`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
    });
    const json = await res.json();
    if (res.ok) {
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), json.data] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
    }
  }

  async function createDeptGroup() {
    setCreatingGroup(true);
    try {
      const res = await fetch('/api/feed/groups', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupNameDraft.trim() || undefined }),
      });
      if (res.ok) { setGroupNameDraft(''); loadGroups(); }
    } finally { setCreatingGroup(false); }
  }

  const card: React.CSSProperties = { background: 'var(--glass-bg)', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(160%)', backdropFilter: 'blur(var(--glass-blur)) saturate(160%)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', padding: '14px 16px', transition: 'transform var(--motion-medium) var(--ease-out-expo), box-shadow var(--motion-medium) var(--ease-out-expo)' };
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const canCreateDeptGroup = userRole === 'department_head' && !groups.some(g => g.type === 'department');

  if (loading) return <LoadingScreen dark={dark} label="Loading Church Feed…" />;

  return (
    <div data-theme={dark ? 'dark' : 'light'} className="shep-page-enter" style={{ minHeight: '100vh', background: dark ? `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.12), transparent 45%), ${t.bg}` : `radial-gradient(circle at 15% 0%, rgba(83,74,183,0.06), transparent 45%), ${t.bg}`, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ background: t.navBg, WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)', borderBottom: `0.5px solid ${t.navBorder}`, padding: isMobile ? 'calc(10px + env(safe-area-inset-top)) 14px 10px' : '0 20px', height: isMobile ? undefined : 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, minWidth: 0 }}>
          <button onClick={() => router.push(homePath)} title="Back to dashboard"
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            style={{ background: t.purpleBg, border: 'none', borderRadius: 'var(--radius-sm)', width: 30, height: 30, cursor: 'pointer', color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform var(--motion-fast) var(--ease-spring)', flexShrink: 0 }}>
            <Icon name="ti-arrow-left" size={15} />
          </button>
          {!isMobile ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, letterSpacing: '0.5px' }}>SHEP.HERD</div>
              <div style={{ fontSize: 10, color: t.muted }}>Church Feed</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Church Feed</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 8, flexShrink: 0 }}>
          <ChatNavButton t={t} compact /><NotificationBell dark={dark} compact={isMobile} /><MyAccountButton dark={dark} compact={isMobile} />
          <ThemeToggle dark={dark} setDark={setDark} border={t.border} compact={isMobile} />
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Church Feed</div>
          <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>Urgent information and department-specific updates, in one place.</div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div className="shep-skeleton" style={{ width: 90, height: 28, borderRadius: 20 }} />
              <div className="shep-skeleton" style={{ width: 120, height: 28, borderRadius: 20 }} />
            </div>
            {[0, 1, 2].map(i => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : groupsError ? (
          <div style={{ ...card, background: t.coralBg, border: `0.5px solid ${t.coral}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.coral, marginBottom: 4 }}>Church Feed couldn&apos;t load</div>
            <div style={{ fontSize: 12, color: t.text }}>{groupsError}</div>
          </div>
        ) : groups.length === 0 ? (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>No feed groups yet</div>
            <div style={{ fontSize: 12, color: t.sub }}>The church-wide feed hasn&apos;t been set up for your account yet. Ask your overseer or technical admin to check the Church Feed setup.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {groups.map(g => (
                <button key={g.id} onClick={() => setActiveGroupId(g.id)}
                  onMouseEnter={e => { if (activeGroupId !== g.id) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  style={{ padding: '7px 15px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: activeGroupId === g.id ? 600 : 400, background: activeGroupId === g.id ? '#534AB7' : 'var(--glass-bg)', borderColor: activeGroupId === g.id ? '#534AB7' : t.border, color: activeGroupId === g.id ? '#fff' : t.sub, boxShadow: activeGroupId === g.id ? '0 2px 10px rgba(83,74,183,0.3)' : 'none', transition: 'all var(--motion-fast) var(--ease-out-expo)' }}>
                  {g.type === 'church' ? g.name : (g.departments?.name || g.name)}
                </button>
              ))}
              {canCreateDeptGroup && (
                <button onClick={() => setCreatingGroup(v => !v)}
                  onMouseEnter={e => { e.currentTarget.style.background = t.purpleBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  style={{ padding: '7px 15px', borderRadius: 20, border: `0.5px dashed ${t.purple}`, cursor: 'pointer', fontSize: 12, background: 'transparent', color: t.purple, transition: 'background var(--motion-fast) var(--ease-out-expo)' }}>
                  + Create my department's group
                </button>
              )}
            </div>

            {creatingGroup && (
              <div style={card}>
                <div style={{ fontSize: 12, color: t.sub, marginBottom: 8 }}>This creates the one group for your department — every current department member with a login is added automatically.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={groupNameDraft} onChange={e => setGroupNameDraft(e.target.value)} placeholder="Group name (optional)"
                    style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: t.input, color: t.text }} />
                  <button onClick={createDeptGroup} disabled={creatingGroup}
                    style={{ background: t.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Create</button>
                </div>
              </div>
            )}

            {activeGroup && (
              <div>
                {!composerOpen ? (
                  <button onClick={() => setComposerOpen(true)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.purple; e.currentTarget.style.color = t.purple; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.muted; }}
                    style={{ ...card, width: '100%', textAlign: 'left', color: t.muted, cursor: 'pointer' }}>
                    + Post to {activeGroup.type === 'church' ? activeGroup.name : (activeGroup.departments?.name || activeGroup.name)}…
                  </button>
                ) : (
                  <div className="shep-pop-enter" style={card}>
                    <textarea value={composerBody} onChange={e => setComposerBody(e.target.value)} rows={3} placeholder="What do you need to say?"
                      style={{ width: '100%', border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, background: t.input, color: t.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 14, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.sub, cursor: 'pointer' }}>
                        <input type="checkbox" checked={composerUrgent} onChange={e => setComposerUrgent(e.target.checked)} /> Mark urgent
                      </label>
                      {activeGroup.type === 'church' && ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(userRole) && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.sub, cursor: 'pointer' }}>
                          <input type="checkbox" checked={composerPinned} onChange={e => setComposerPinned(e.target.checked)} /> Pin to top
                        </label>
                      )}
                    </div>
                    {postError && <div style={{ color: t.coral, fontSize: 12, marginTop: 8 }}>{postError}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={submitPost} disabled={posting || !composerBody.trim()}
                        style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: posting ? 'wait' : 'pointer' }}>
                        {posting ? 'Posting…' : 'Post'}
                      </button>
                      <button onClick={() => { setComposerOpen(false); setComposerBody(''); setPostError(''); }}
                        style={{ background: 'transparent', color: t.muted, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {postsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1].map(i => <SkeletonCard key={i} lines={2} />)}
              </div>
            ) : posts.length === 0 ? (
              <div style={card}><div style={{ textAlign: 'center', padding: 24, color: t.muted, fontSize: 13 }}>Nothing posted here yet.</div></div>
            ) : posts.map((p, pi) => (
              <div key={p.id} className="shep-tab-enter" style={{ ...card, borderLeftWidth: p.urgent ? 3 : undefined, borderLeftColor: p.urgent ? t.coral : undefined, animationDelay: `${Math.min(pi, 6) * 40}ms` }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = dark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(83,74,183,0.14)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--glass-shadow)'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{p.author_name} <span style={{ fontWeight: 400, color: t.muted, textTransform: 'capitalize' }}>· {p.author_role.replace(/_/g, ' ')}</span></div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>{timeAgo(p.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.pinned && <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: t.purpleBg, color: t.purple, fontWeight: 600 }}>Pinned</span>}
                    {p.urgent && <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: t.coralBg, color: t.coral, fontWeight: 600 }}>Urgent</span>}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: t.text, marginTop: 8, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{p.body}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10, alignItems: 'center' }}>
                  <button onClick={() => toggleAck(p.id)}
                    style={{ background: p.acknowledged_by_me ? t.tealBg : 'transparent', color: p.acknowledged_by_me ? t.teal : t.muted, border: `0.5px solid ${p.acknowledged_by_me ? t.teal : t.border}`, borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all var(--motion-fast) var(--ease-spring)' }}>
                    {p.acknowledged_by_me ? 'Acknowledged' : 'Acknowledge'}{p.ack_count > 0 ? ` · ${p.ack_count}` : ''}
                  </button>
                  <button onClick={() => toggleExpand(p.id)} style={{ background: 'transparent', border: 'none', color: t.purple, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                    {p.comment_count > 0 ? `${p.comment_count} comment${p.comment_count !== 1 ? 's' : ''}` : 'Comment'}
                  </button>
                </div>
                {expandedPost === p.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${t.border}` }}>
                    {(comments[p.id] || []).map(c => (
                      <div key={c.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{c.author_name}</div>
                        <div style={{ fontSize: 12, color: t.sub }}>{c.body}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder="Write a comment…"
                        onKeyDown={e => { if (e.key === 'Enter') submitComment(p.id); }}
                        style={{ flex: 1, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, background: t.input, color: t.text }} />
                      <button onClick={() => submitComment(p.id)} style={{ background: t.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Send</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
