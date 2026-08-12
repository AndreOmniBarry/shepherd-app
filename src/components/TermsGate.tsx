'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { TERMS_SECTIONS } from '@/lib/terms-content';

// Same "don't bother pre-auth flows" list AppLockGate uses — there's no
// signed-in user to prompt on the landing page, login, register, setup
// wizard, docs, or a public event page, so don't even fetch terms-status
// there.
function isPublicRoute(path: string): boolean {
  return path === '/' || path === '/login' || path === '/register' || path === '/setup' || path.startsWith('/docs') || path.startsWith('/events/');
}

export default function TermsGate() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  useEffect(() => {
    if (checkedOnce || isPublicRoute(pathname || '')) return;
    setCheckedOnce(true);
    fetch('/api/auth/terms-status', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.authenticated && data?.mustAccept) setShow(true); })
      .catch(() => {}); // network hiccup — don't block the app over a status check
  }, [pathname, checkedOnce]);

  async function accept() {
    if (!checked) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/accept-terms', { method: 'POST', credentials: 'include' });
      if (res.ok) setShow(false);
    } catch { /* leave the gate up — they can retry */ }
    setSubmitting(false);
  }

  if (!show) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(8,6,20,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#0F0A2E', border: '0.5px solid rgba(168,159,255,0.15)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '22px 26px 16px', borderBottom: '0.5px solid rgba(168,159,255,0.1)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#E8E5FF' }}>Terms of Use</div>
          <div style={{ fontSize: 12, color: 'rgba(232,229,255,0.5)', marginTop: 3 }}>Please review before continuing.</div>
        </div>
        <div style={{ padding: '18px 26px', overflowY: 'auto', flex: 1 }}>
          {TERMS_SECTIONS.map(s => (
            <div key={s.heading} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#A89FFF', marginBottom: 4 }}>{s.heading}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(232,229,255,0.7)', lineHeight: 1.6 }}>{s.body}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 26px 22px', borderTop: '0.5px solid rgba(168,159,255,0.1)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
              style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, accentColor: '#534AB7' }} />
            <span style={{ fontSize: 12.5, color: 'rgba(232,229,255,0.8)', lineHeight: 1.5 }}>I have read and agree to the Terms of Use.</span>
          </label>
          <button onClick={accept} disabled={!checked || submitting}
            style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: checked ? '#534AB7' : 'rgba(168,159,255,0.15)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: checked && !submitting ? 'pointer' : 'default', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit', transition: 'background 0.15s' }}>
            {submitting ? 'Saving…' : 'Agree and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
