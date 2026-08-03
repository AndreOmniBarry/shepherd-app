'use client';
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

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'block', padding: '7px 12px', borderRadius: 8, fontSize: 13,
    fontWeight: active ? 700 : 500, color: active ? C.purple : C.sub,
    background: active ? '#EEEDFE' : 'transparent', textDecoration: 'none',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', gap: 32, padding: '28px 24px 80px' }} className="shep-docs-shell">
        <div style={{ width: 220, flexShrink: 0 }} className="shep-docs-sidebar">
          <div style={{ position: 'sticky', top: 76 }} className="shep-docs-sidebar-inner">
            <Link href="/docs" style={linkStyle(pathname === '/docs')}>Overview</Link>

            <div className="shep-docs-section-label" style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '18px 0 6px', padding: '0 12px' }}>Features</div>
            {FEATURE_DOCS.map(f => (
              <Link key={f.slug} href={`/docs/features/${f.slug}`} style={linkStyle(pathname === `/docs/features/${f.slug}`)}>{f.title}</Link>
            ))}

            <div className="shep-docs-section-label" style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '18px 0 6px', padding: '0 12px' }}>Role Guides</div>
            {ROLE_DOCS.map(r => (
              <Link key={r.slug} href={`/docs/roles/${r.slug}`} style={linkStyle(pathname === `/docs/roles/${r.slug}`)}>{r.title}</Link>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .shep-docs-shell { flex-direction: column; }
          .shep-docs-sidebar { width: 100% !important; }
          .shep-docs-sidebar-inner { position: static !important; display: flex; flex-wrap: wrap; gap: 4px; }
          .shep-docs-section-label { width: 100%; margin: 10px 0 2px !important; }
        }
      `}</style>
    </div>
  );
}
