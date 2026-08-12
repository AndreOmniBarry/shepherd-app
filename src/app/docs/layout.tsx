'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FEATURE_DOCS, ROLE_DOCS } from '@/lib/docs-content';

const C = {
  purple: '#534AB7', purpleDark: '#3C3489',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', white: '#FFFFFF', bg: '#F4F3FB',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'block', padding: '7px 12px', borderRadius: 8, fontSize: 13,
    fontWeight: active ? 700 : 500, color: active ? C.purple : C.sub,
    background: active ? '#EEEDFE' : 'transparent', textDecoration: 'none',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  });

  const pillStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-block', padding: '7px 13px', borderRadius: 20, fontSize: 12.5,
    fontWeight: active ? 700 : 500, color: active ? C.purple : C.sub,
    background: active ? '#EEEDFE' : C.white, border: `0.5px solid ${active ? 'transparent' : C.border}`,
    textDecoration: 'none', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)' }}>
      <div style={{ borderBottom: `0.5px solid ${C.border}`, background: 'rgba(244,243,251,0.9)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 26, height: 26, background: C.purple, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', width: 3.5, height: 14, background: C.white, borderRadius: 2 }} />
              <div style={{ position: 'absolute', width: 14, height: 3.5, background: C.white, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>SHEP.HERD</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginLeft: 2 }}>Docs</span>
          </button>
          <button onClick={() => router.push('/setup')} style={{ background: C.purple, color: C.white, border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Start free trial
          </button>
        </div>

        {/* Mobile-only collapsible nav — collapsed by default so the actual
            page content is what you see first, not a wall of 17 links. */}
        <button onClick={() => setMobileNavOpen(v => !v)} className="shep-docs-mobile-toggle"
          style={{ display: 'none', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', borderTop: `0.5px solid ${C.border}`, padding: '12px 24px', fontSize: 13, fontWeight: 600, color: C.text, cursor: 'pointer' }}>
          Browse guides
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ transform: mobileNavOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {mobileNavOpen && (
          <div className="shep-docs-mobile-nav" style={{ display: 'none', padding: '4px 24px 16px', borderTop: `0.5px solid ${C.border}` }}>
            <Link href="/docs" onClick={() => setMobileNavOpen(false)} style={pillStyle(pathname === '/docs')}>Overview</Link>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '14px 0 8px' }}>Features</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {FEATURE_DOCS.map(f => (
                <Link key={f.slug} href={`/docs/features/${f.slug}`} onClick={() => setMobileNavOpen(false)} style={pillStyle(pathname === `/docs/features/${f.slug}`)}>{f.title}</Link>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '16px 0 8px' }}>Role Guides</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {ROLE_DOCS.map(r => (
                <Link key={r.slug} href={`/docs/roles/${r.slug}`} onClick={() => setMobileNavOpen(false)} style={pillStyle(pathname === `/docs/roles/${r.slug}`)}>{r.title}</Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', gap: 32, padding: '28px 24px 80px' }} className="shep-docs-shell">
        <div style={{ width: 220, flexShrink: 0 }} className="shep-docs-sidebar">
          <div style={{ position: 'sticky', top: 76 }}>
            <Link href="/docs" style={linkStyle(pathname === '/docs')}>Overview</Link>

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '18px 0 6px', padding: '0 12px' }}>Features</div>
            {FEATURE_DOCS.map(f => (
              <Link key={f.slug} href={`/docs/features/${f.slug}`} style={linkStyle(pathname === `/docs/features/${f.slug}`)}>{f.title}</Link>
            ))}

            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '18px 0 6px', padding: '0 12px' }}>Role Guides</div>
            {ROLE_DOCS.map(r => (
              <Link key={r.slug} href={`/docs/roles/${r.slug}`} style={linkStyle(pathname === `/docs/roles/${r.slug}`)}>{r.title}</Link>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>

      <div style={{ borderTop: `0.5px solid ${C.border}`, padding: '20px 24px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', textAlign: 'center', fontSize: 12.5, color: C.muted }}>
          Can&apos;t find what you need? <a href="mailto:support@justshephrd.com" style={{ color: C.purple, fontWeight: 600, textDecoration: 'none' }}>support@justshephrd.com</a>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .shep-docs-shell { flex-direction: column; padding-top: 0 !important; }
          .shep-docs-sidebar { display: none !important; }
          .shep-docs-mobile-toggle { display: flex !important; }
          .shep-docs-mobile-nav { display: block !important; }
        }
      `}</style>
    </div>
  );
}
