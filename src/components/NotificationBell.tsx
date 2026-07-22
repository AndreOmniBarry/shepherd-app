'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

type Notification = {
  id: string;
  type: 'system' | 'pastoral' | 'pipeline' | 'dispute' | 'birthday' | 'achievement' | 'sla' | 'attendance' | 'giving';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  link?: string;
};

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  system:      { color: '#534AB7', bg: '#EEEDFE', icon: '⚙' },
  pastoral:    { color: '#BA7517', bg: '#FAEEDA', icon: '✉' },
  pipeline:    { color: '#1D9E75', bg: '#E1F5EE', icon: '👤' },
  dispute:     { color: '#BA7517', bg: '#FAEEDA', icon: '⚑' },
  birthday:    { color: '#D85A30', bg: '#FAECE7', icon: '🎂' },
  achievement: { color: '#534AB7', bg: '#EEEDFE', icon: '★' },
  sla:         { color: '#D85A30', bg: '#FAECE7', icon: '⏱' },
  attendance:  { color: '#1D9E75', bg: '#E1F5EE', icon: '✓' },
  giving:      { color: '#534AB7', bg: '#EEEDFE', icon: '₦' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface NotificationBellProps {
  dark?: boolean;
  t?: Record<string, string>;
}

export default function NotificationBell({ dark = false }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCount, setNewCount] = useState(0); // tracks new since last open
  const ref = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const unread = notifications.filter(n => !n.read).length;

  const t = {
    card:    dark ? '#13102A' : '#FFFFFF',
    border:  dark ? 'rgba(168,159,255,0.12)' : 'rgba(83,74,183,0.12)',
    text:    dark ? '#E8E5FF' : '#1A1040',
    sub:     dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted:   dark ? 'rgba(232,229,255,0.35)' : '#9990CC',
    hover:   dark ? '#1A1635' : '#F7F6FF',
    divider: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.08)',
    bg:      dark ? '#0D0B1E' : '#F0EFF8',
  };

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    fetch('/api/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.notifications) {
          const notifs: Notification[] = data.notifications;
          setNotifications(notifs);
          // Track new notifications since last poll
          const currentUnread = notifs.filter(n => !n.read).length;
          if (currentUnread > prevCountRef.current && prevCountRef.current > 0) {
            setNewCount(v => v + (currentUnread - prevCountRef.current));
          }
          prevCountRef.current = currentUnread;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Poll every 15 seconds for near-real-time updates
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Supabase Realtime subscription for instant push
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    // Use Supabase Realtime via WebSocket
    let ws: WebSocket | null = null;
    try {
      const wsUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + supabaseKey + '&vsn=1.0.0';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws?.send(JSON.stringify({
          topic: 'realtime:public:notifications',
          event: 'phx_join',
          payload: { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'notifications' }] } },
          ref: null,
        }));
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.event === 'postgres_changes' || data.payload?.data?.type === 'INSERT') {
            // New notification arrived — fetch immediately
            fetchNotifications();
          }
        } catch {}
      };

      ws.onerror = () => {}; // Silent fail — polling is the fallback
    } catch {}

    return () => { ws?.close(); };
  }, [fetchNotifications]);

  async function markAllRead() {
    await fetch('/api/notifications/read', { method: 'POST', credentials: 'include' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setNewCount(0);
    prevCountRef.current = 0;
  }

  async function dismissOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function handleOpen() {
    setOpen(v => !v);
    setNewCount(0);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button onClick={handleOpen}
        style={{
          width: 34, height: 34, borderRadius: 9,
          border: `0.5px solid ${t.border}`,
          background: open ? (dark ? 'rgba(83,74,183,0.3)' : '#EEEDFE') : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative',
          transition: 'all 0.15s ease',
          boxShadow: open ? (dark ? '0 0 12px rgba(83,74,183,0.3)' : '0 0 8px rgba(83,74,183,0.1)') : 'none',
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? '#A89FFF' : '#534AB7'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            background: newCount > 0 ? '#D85A30' : '#534AB7',
            color: '#fff', borderRadius: 10,
            fontSize: 9, fontWeight: 700,
            padding: '1px 4px', minWidth: 16,
            textAlign: 'center', lineHeight: '14px',
            animation: newCount > 0 ? 'pulse 1s ease-in-out 3' : 'none',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 42,
          width: 340, maxHeight: 480,
          background: t.card,
          border: `0.5px solid ${t.border}`,
          borderRadius: 14,
          boxShadow: dark
            ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(168,159,255,0.1)'
            : '0 8px 32px rgba(83,74,183,0.12)',
          zIndex: 100,
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          animation: 'conceptFadeIn 0.15s ease',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 16px',
            borderBottom: `0.5px solid ${t.divider}`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Notifications</div>
              {unread > 0 && <div style={{ fontSize: 10, color: '#534AB7', marginTop: 1 }}>{unread} unread</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {loading && <div style={{ fontSize: 10, color: t.muted }}>↻</div>}
              {unread > 0 && (
                <button onClick={markAllRead}
                  style={{ fontSize: 11, color: '#534AB7', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', maxHeight: 400 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px' }}>
                  <path d="M8.7 3A6 6 0 0 1 18 8c0 4.4 1.3 6.9 2.3 8.2M6 8a6 6 0 0 0 .17 1.4M18 15.3V16H2s1.6-1.1 2.7-3.9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  <line x1="2" y1="2" x2="22" y2="22"/>
                </svg>
                <div style={{ fontSize: 13, color: t.sub }}>No notifications yet</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>Updates from your portal appear here</div>
              </div>
            ) : (
              notifications.map((n, i) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                return (
                  <div key={n.id}
                    style={{
                      display: 'flex', gap: 11, padding: '11px 16px',
                      borderBottom: i < notifications.length - 1 ? `0.5px solid ${t.divider}` : 'none',
                      background: n.read ? 'transparent' : (dark ? 'rgba(83,74,183,0.06)' : 'rgba(83,74,183,0.02)'),
                      cursor: 'pointer', position: 'relative',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.hover}
                    onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : (dark ? 'rgba(83,74,183,0.06)' : 'rgba(83,74,183,0.02)')}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: cfg.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 14, marginTop: 1,
                    }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600, color: t.text, lineHeight: 1.4, marginBottom: 2 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.5, marginBottom: 3 }}>
                        {n.body}
                      </div>
                      <div style={{ fontSize: 10, color: t.muted }}>{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.read && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#534AB7', flexShrink: 0, marginTop: 4 }} />
                    )}
                    <button onClick={e => dismissOne(n.id, e)}
                      style={{
                        position: 'absolute', top: 8, right: 10,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: t.muted, fontSize: 14, lineHeight: 1, padding: 2, opacity: 0,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding: '9px 16px', borderTop: `0.5px solid ${t.divider}`, textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: t.muted }}>
                Updates every 15 seconds · {notifications.length} total
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
