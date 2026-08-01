'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const LOCK_KEY = 'shepherd-last-active';
// How long the app can sit backgrounded/closed before it demands the
// password again — banking-app style. Short enough that a phone left
// unattended for a minute or two doesn't stay wide open, long enough
// that switching to check a text message doesn't lock every time.
const LOCK_THRESHOLD_MS = 90 * 1000;

// No session/cookie is touched here — the JWT stays valid the whole time.
// This is purely a client-side "soft lock" screen: if the app was hidden
// (backgrounded, minimized, or the OS killed and relaunched it) longer
// than the threshold, cover the UI and require the password again before
// showing anything underneath.
export default function AppLockGate() {
  const [locked, setLocked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailFetched = useRef(false);

  const touch = useCallback(() => {
    try { localStorage.setItem(LOCK_KEY, String(Date.now())); } catch { /* storage unavailable — lock just won't persist across a full close */ }
  }, []);

  const checkStale = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCK_KEY);
      if (raw && Date.now() - Number(raw) > LOCK_THRESHOLD_MS) setLocked(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    // Nothing to lock before the user is even signed in, and event pages
    // are meant to be publicly shareable links.
    if (path === '/login' || path === '/register' || path === '/setup' || path.startsWith('/events/')) return;

    checkStale();
    touch();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') touch();
      else { checkStale(); touch(); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const iv = setInterval(touch, 15000);
    return () => { document.removeEventListener('visibilitychange', onVisibility); clearInterval(iv); };
  }, [checkStale, touch]);

  useEffect(() => {
    if (!locked || emailFetched.current) return;
    emailFetched.current = true;
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      if (data?.email) setEmail(data.email);
    }).catch(() => {});
  }, [locked]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) { setLocked(false); setPassword(''); touch(); }
      else setError('Incorrect password.');
    } catch {
      setError('Could not verify — check your connection.');
    }
    setSubmitting(false);
  }

  if (!locked) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,6,20,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <div style={{ width: 40, height: 40, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', width: 5, height: 28, background: '#A89FFF', borderRadius: 3 }} />
        <div style={{ position: 'absolute', width: 20, height: 5, background: '#A89FFF', borderRadius: 3 }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#E8E5FF', marginBottom: 4 }}>Welcome back</div>
        <div style={{ fontSize: 12, color: 'rgba(232,229,255,0.5)' }}>{email ? `Enter your password to continue as ${email}` : 'Enter your password to continue'}</div>
      </div>
      <form onSubmit={unlock} style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
          style={{ padding: '12px 14px', borderRadius: 10, border: '0.5px solid rgba(168,159,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#E8E5FF', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
        {error && <div style={{ fontSize: 12, color: '#F0876B', textAlign: 'center' }}>{error}</div>}
        <button type="submit" disabled={submitting || !password}
          style={{ padding: '12px', borderRadius: 10, border: 'none', background: '#534AB7', color: '#fff', fontSize: 14, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', opacity: submitting || !password ? 0.6 : 1, fontFamily: 'inherit' }}>
          {submitting ? 'Verifying…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
