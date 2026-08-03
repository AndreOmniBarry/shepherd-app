'use client';
import Link from 'next/link';
import { FEATURE_DOCS, ROLE_DOCS } from '@/lib/docs-content';

const C = {
  purple: '#534AB7', purpleBg: '#EEEDFE',
  teal: '#1D9E75', tealBg: '#E1F5EE',
  amber: '#BA7517', amberBg: '#FAEEDA',
  coral: '#D85A30', coralBg: '#FAECE7',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', white: '#FFFFFF',
};

const ACCENTS: Record<string, { c: string; bg: string }> = {
  purple: { c: C.purple, bg: C.purpleBg },
  teal: { c: C.teal, bg: C.tealBg },
  amber: { c: C.amber, bg: C.amberBg },
  coral: { c: C.coral, bg: C.coralBg },
};

export default function DocsPage() {
  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Documentation</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: '-0.5px', marginBottom: 12 }}>See exactly how SHEP.HERD works</h1>
        <p style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.65, maxWidth: 640 }}>
          Every feature below shows the same live screen on Desktop, Mobile, and iOS — toggle between them on each page. If you already know your role, jump straight to its guide.
        </p>
      </div>

      <div style={{ marginBottom: 20, fontSize: 13, fontWeight: 700, color: C.text }}>Explore by feature</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 48 }}>
        {FEATURE_DOCS.map(f => {
          const a = ACCENTS[f.accent];
          return (
            <Link key={f.slug} href={`/docs/features/${f.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 20, height: '100%', boxSizing: 'border-box' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.c, marginBottom: 12 }} />
                <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>{f.tagline}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ marginBottom: 20, fontSize: 13, fontWeight: 700, color: C.text }}>Guides by role</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {ROLE_DOCS.map(r => (
          <Link key={r.slug} href={`/docs/roles/${r.slug}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 20, height: '100%', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>{r.portal}</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>{r.title}</div>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>{r.summary}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
