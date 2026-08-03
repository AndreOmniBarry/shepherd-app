'use client';
import { useRouter } from 'next/navigation';

const C = {
  purple: '#534AB7', purpleDark: '#3C3489', purpleBg: '#EEEDFE',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', white: '#FFFFFF', bg: '#F4F3FB',
};

// Placeholder shell for the full docs site (feature walkthroughs with live
// web/iOS/mobile mockups, plus per-role manuals) — tracked separately.
// This keeps the landing page's Docs link real instead of a dead 404 in
// the meantime.
export default function DocsPage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, background: C.purple, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', position: 'relative' }}>
          <div style={{ position: 'absolute', width: 5, height: 22, background: C.white, borderRadius: 2.5 }} />
          <div style={{ position: 'absolute', width: 22, height: 5, background: C.white, borderRadius: 2.5 }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Documentation</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.4px', marginBottom: 12 }}>Full docs are on the way</h1>
        <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.65, marginBottom: 28 }}>
          Feature walkthroughs, live product previews, and role-by-role guides for every portal are coming to this page. For now, the fastest way to see SHEP.HERD is to start a trial — every core feature is unlocked from day one.
        </p>
        <button onClick={() => router.push('/setup')} style={{ background: C.purple, color: C.white, border: 'none', borderRadius: 11, padding: '13px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
          Start your free trial →
        </button>
        <div>
          <button onClick={() => router.push('/')} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Back to home</button>
        </div>
      </div>
    </div>
  );
}
