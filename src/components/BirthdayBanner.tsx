'use client';
import { useState, useEffect } from 'react';
import Icon from '@/components/Icon';

// Self-contained "it's your birthday" banner — fetches its own /api/auth/me
// (same pattern as NotificationBell) rather than requiring every portal
// page to thread the flag through, so mounting it is a one-line addition
// per portal. Dismissible for the rest of the day only (localStorage key
// scoped to today's date) — it comes back tomorrow if it's still your
// birthday somehow, but won't nag for the rest of today once dismissed.
interface BirthdayBannerProps {
  isMobile?: boolean;
}

export default function BirthdayBanner({ isMobile = false }: BirthdayBannerProps) {
  const [show, setShow] = useState(false);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (!data?.is_birthday_today) return;
        const todayKey = `shepherd_birthday_banner_dismissed_${new Date().toISOString().split('T')[0]}`;
        try { if (window.localStorage.getItem(todayKey)) return; } catch { /* private mode — just show it */ }
        setFirstName((data.name || '').split(' ')[0] || 'there');
        setShow(true);
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      const todayKey = `shepherd_birthday_banner_dismissed_${new Date().toISOString().split('T')[0]}`;
      window.localStorage.setItem(todayKey, '1');
    } catch { /* private mode — dismissal just won't persist across reloads today */ }
  }

  return (
    <div style={{
      margin: isMobile ? '0 12px' : '0 20px', marginTop: 12,
      background: 'linear-gradient(135deg, #FAEEDA 0%, #EEEDFE 100%)',
      border: '0.5px solid rgba(186,117,23,0.25)', borderRadius: 12,
      padding: isMobile ? '12px 14px' : '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ color: '#BA7517', flexShrink: 0 }}><Icon name="ti-cake" size={isMobile ? 22 : 26} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#633806' }}>🎉 Happy Birthday, {firstName}!</div>
        <div style={{ fontSize: isMobile ? 11 : 12, color: '#8A5A0F', marginTop: 2 }}>Wishing you a wonderful day — from your whole SHEP.HERD family.</div>
      </div>
      <button onClick={dismiss} style={{ background: 'transparent', border: 'none', color: '#BA7517', cursor: 'pointer', padding: 4, flexShrink: 0 }} aria-label="Dismiss">
        <Icon name="ti-x" size={16} />
      </button>
    </div>
  );
}
