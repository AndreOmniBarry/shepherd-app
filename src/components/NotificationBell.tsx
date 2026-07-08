'use client';
import { useState, useEffect, useRef } from 'react';

type Notification = {
  id: string;
  type: 'system' | 'pastoral' | 'pipeline' | 'dispute' | 'birthday' | 'achievement' | 'sla';
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
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NotificationBellProps {
  dark?: boolean;
}

export default function NotificationBell({ dark = false }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  const t = {
    card:    dark ? '#13102A' : '#FFFFFF',
    border:  dark ? 'rgba(168,159,255,0.12)' : 'rgba(83,74,183,0.12)',
    text:    dark ? '#E8E5FF' : '#1A1040',
    sub:     dark ? 'rgba(232,229,255,0.6)' : '#5A5180',
    muted:   dark ? 'rgba(232,229,255,0.35)' : '#9990CC',
    hover:   dark ? '#1A1635' : '#F7F6FF',
    divider: dark ? 'rgba(168,159,255,0.08)' : 'rgba(83,74,183,0.08)',
    iconBg:  dark ? 'rgba(255,255,255,0.05)' : 'transparent',
    iconBorder: dark ? 'rgba(168,159,255,0.1)' : 'rgba(83,74,183,0.12)',
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  // Poll for new notifications every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  function fetchNotifications() {
    fetch('/api/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.notifications) setNotifications(data.notifications);
      })
      .catch(() => {});
  }

  async function markAllRead() {
    await fetch('/api/notifications/read', { method: 'POST', credentials: 'include' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function dismissOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell icon */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: `0.5px solid ${t.iconBorder}`,
          background: t.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative',
          color: dark ? 'rgba(232,229,255,0.5)' : '#5A5180',
        }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: -3, right: -3,
            width: 16, height: 16, borderRadius: '50%',
            background: '#D85A30', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${dark ? '#080614' : '#F0EFF8'}`,
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </div>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 40, right: 0,
          width: 340, maxHeight: 480,
          background: t.card,
          border: `0.5px solid ${t.border}`,
          borderRadius: 12,
          boxShadow: dark
            ? '0 8px 32px rgba(0,0,0,0.4)'
            : '0 8px 32px rgba(83,74,183,0.12)',
          zIndex: 100,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 16px',
            borderBottom: `0.5px solid ${t.divider}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
              Notifications {unread > 0 && <span style={{ fontSize: 11, color: '#534AB7', fontWeight: 500 }}>· {unread} new</span>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ fontSize: 11, color: '#534AB7', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                <div style={{ fontSize: 13, color: t.sub }}>No notifications yet</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>System alerts and messages will appear here</div>
              </div>
            ) : (
              notifications.map((n, i) => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                return (
                  <div key={n.id} style={{
                    display: 'flex', gap: 10, padding: '12px 16px',
                    borderBottom: i < notifications.length - 1 ? `0.5px solid ${t.divider}` : 'none',
                    background: n.read ? 'transparent' : (dark ? 'rgba(83,74,183,0.06)' : 'rgba(83,74,183,0.03)'),
                    cursor: 'default', position: 'relative',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = t.hover}
                    onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : (dark ? 'rgba(83,74,183,0.06)' : 'rgba(83,74,183,0.03)')}>

                    {/* Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: cfg.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 14, marginTop: 1,
                    }}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600, color: t.text, lineHeight: 1.4, marginBottom: 3 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.5, marginBottom: 4 }}>
                        {n.body}
                      </div>
                      <div style={{ fontSize: 10, color: t.muted }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#534AB7', flexShrink: 0, marginTop: 4 }} />
                    )}

                    {/* Dismiss X */}
                    <button onClick={e => dismissOne(n.id, e)}
                      style={{
                        position: 'absolute', top: 8, right: 10,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: t.muted, fontSize: 14, lineHeight: 1, padding: 2,
                        opacity: 0,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: `0.5px solid ${t.divider}`, textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: t.muted }}>
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · auto-refreshes every minute
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
