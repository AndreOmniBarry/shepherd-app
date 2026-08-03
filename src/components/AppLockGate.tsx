'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

const LOCK_KEY = 'shepherd-last-active';
const LOCKED_KEY = 'shepherd-locked';
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
function isPublicRoute(path: string): boolean {
  return path === '/' || path === '/login' || path === '/register' || path === '/setup' || path.startsWith('/docs') || path.startsWith('/events/');
}

export default function AppLockGate() {
  const pathname = usePathname();
  const [locked, setLocked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailFetched = useRef(false);

  function isLockedFlag(): boolean {
    try { return localStorage.getItem(LOCKED_KEY) === 'true'; } catch { return false; }
  }

  const touch = useCallback(() => {
    // Never refresh the clock while locked — this used to run
    // unconditionally, which meant detecting staleness (below) and then
    // immediately touch()-ing reset the timestamp to "now". A refresh
    // right after landing on the lock screen would then see a fresh
    // timestamp on remount and skip locking entirely — the password
    // screen could be bypassed just by reloading the page. Confirmed as
    // a real bypass, not theoretical.
    if (isLockedFlag()) return;
    try { localStorage.setItem(LOCK_KEY, String(Date.now())); } catch { /* storage unavailable — lock just won't persist across a full close */ }
  }, []);

  // Marks the app as locked AND PERSISTS that fact in localStorage so it
  // survives a full page reload — only unlock() below is allowed to clear it.
  const lock = useCallback(() => {
    try { localStorage.setItem(LOCKED_KEY, 'true'); } catch { /* ignore */ }
    setLocked(true);
  }, []);

  const checkStale = useCallback(() => {
    try {
      if (isLockedFlag()) { setLocked(true); return; }
      const raw = localStorage.getItem(LOCK_KEY);
      if (raw && Date.now() - Number(raw) > LOCK_THRESHOLD_MS) lock();
    } catch { /* ignore */ }
  }, [lock]);

  useEffect(() => {
    // Nothing to lock before the user is even signed in — the public
    // marketing site (landing page, docs) and the pre-auth flows (login,
    // register, setup, public event pages) all need to stay lock-free.
    // This component lives in the root layout and never unmounts between
    // route changes, so idle time spent reading the landing page used to
    // arm the 90s timer there and then fire once the visitor clicked
    // through to /setup — demanding a password for an account that was
    // never created. Confirmed as a real signup blocker, not theoretical.
    if (isPublicRoute(pathname || '')) return;

    checkStale();
    touch();

    // touch() must only fire on REAL user activity (mouse/keyboard/touch/
    // scroll), not on a timer — a blind setInterval(touch, ...) kept
    // re-stamping "last active" as fresh every tick purely because the tab
    // was open, whether or not anyone was actually using it. That meant
    // sitting idle on an open tab for 7+ minutes — even refreshing —
    // never locked, since the timestamp was never allowed to go stale in
    // the first place. Confirmed as a real regression, not theoretical.
    let lastTouch = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouch < 5000) return; // throttle — mousemove/scroll fire constantly
      lastTouch = now;
      touch();
    };
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'] as const;
    activityEvents.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));

    // checkStale() itself runs on a plain interval — this is what actually
    // catches "idle while the tab stayed open and visible", which the old
    // touch()-on-interval design could never detect. Safe even if browsers
    // throttle it while backgrounded: checkStale() only ever reads the
    // clock, it never refreshes it, so a delayed tick still locks correctly
    // once it does run.
    const iv = setInterval(checkStale, 15000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') { checkStale(); touch(); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, onActivity));
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkStale, touch, pathname]);

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
      if (res.ok) {
        try { localStorage.removeItem(LOCKED_KEY); } catch { /* ignore */ }
        setLocked(false); setPassword(''); touch();
      }
      else setError('Incorrect password.');
    } catch {
      setError('Could not verify — check your connection.');
    }
    setSubmitting(false);
  }

  // Defense in depth: this component never unmounts between route changes,
  // so `locked` could still be true from an earlier authenticated route
  // even after navigating to a public one — never show the password
  // prompt here regardless of how `locked` got set.
  if (!locked || isPublicRoute(pathname || '')) return null;

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
