'use client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { featureBySlug, roleBySlug } from '@/lib/docs-content';
import DocsMockup from '@/components/DocsMockup';

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

export default function FeatureDocPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const feature = featureBySlug(slug);

  if (!feature) {
    return (
      <div>
        <div style={{ fontSize: 15, color: C.sub, marginBottom: 16 }}>That feature page doesn't exist.</div>
        <Link href="/docs" style={{ color: C.purple, fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>← Back to docs</Link>
      </div>
    );
  }

  const a = ACCENTS[feature.accent];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: a.c, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Feature</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: '-0.5px', marginBottom: 10 }}>{feature.title}</h1>
        <div style={{ fontSize: 15, color: a.c, fontWeight: 600, marginBottom: 14 }}>{feature.tagline}</div>
        <p style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.7, maxWidth: 640 }}>{feature.description}</p>
      </div>

      <div style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 18, padding: '28px 20px', marginBottom: 32 }}>
        <DocsMockup
          appName={feature.mock.appName}
          nav={feature.mock.nav}
          activeIndex={feature.mock.activeIndex}
          heading={feature.mock.heading}
          tiles={feature.mock.tiles}
          chartLabel={feature.mock.chartLabel}
          chartValues={feature.mock.chartValues}
          accent={feature.accent}
        />
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14 }}>What you can do</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {feature.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>
              <span style={{ color: a.c, fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>

      {feature.relatedRoles.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>See it from these roles</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {feature.relatedRoles.map(slug => {
              const role = roleBySlug(slug);
              if (!role) return null;
              return (
                <Link key={slug} href={`/docs/roles/${slug}`} style={{ fontSize: 12.5, fontWeight: 600, color: a.c, background: a.bg, borderRadius: 20, padding: '6px 14px', textDecoration: 'none' }}>
                  {role.title} →
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={() => router.push('/setup')} style={{ background: a.c, color: C.white, border: 'none', borderRadius: 11, padding: '13px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Start your free trial →
      </button>
    </div>
  );
}
