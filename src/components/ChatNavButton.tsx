'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';

// Shared "Chat" topbar entry point, used identically across every portal —
// polls its own unread total so the numbered badge stays live without each
// page having to wire that up separately.
export default function ChatNavButton({ t, compact = false }: { t: Record<string, string>; compact?: boolean }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    fetch('/api/chat/threads', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      const total = (data?.threads || []).reduce((a: number, th: { unread_count: number }) => a + (th.unread_count || 0), 0);
      setUnread(total);
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);

  return (
    <button onClick={() => router.push('/chat')} title="Chat"
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: compact ? 0 : '6px 12px', width: compact ? 30 : undefined, height: compact ? 30 : undefined, justifyContent: compact ? 'center' : undefined, borderRadius: 8, border: `0.5px solid ${t.navBorder || t.border}`, background: 'transparent', fontSize: 11, color: t.sub, cursor: 'pointer', fontFamily: 'inherit' }}>
      <Icon name="ti-message-circle" size={13} />{!compact && 'Chat'}
      {unread > 0 && (
        <span style={{ position: compact ? 'absolute' : 'static', top: compact ? -4 : undefined, right: compact ? -4 : undefined, background: '#D85A30', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: compact ? '1px 4px' : '1px 6px', minWidth: 14, textAlign: 'center', lineHeight: 1.4 }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
