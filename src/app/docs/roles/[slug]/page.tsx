'use client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { roleBySlug, FEATURE_DOCS } from '@/lib/docs-content';

const C = {
  purple: '#534AB7', purpleBg: '#EEEDFE',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', white: '#FFFFFF',
};

export default function RoleDocPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const role = roleBySlug(slug);

  if (!role) {
    return (
      <div>
        <div style={{ fontSize: 15, color: C.sub, marginBottom: 16 }}>That role guide doesn't exist.</div>
        <Link href="/docs" style={{ color: C.purple, fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>← Back to docs</Link>
      </div>
    );
  }

  const relatedFeatures = FEATURE_DOCS.filter(f => f.relatedRoles.includes(role.slug));

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Role Guide · {role.portal}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: '-0.5px', marginBottom: 12 }}>{role.title}</h1>
        <p style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.7, maxWidth: 640 }}>{role.summary}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
        {role.sections.map((section, i) => (
          <div key={i} style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, marginBottom: 14 }}>{section.heading}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {section.steps.map((step, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.purpleBg, color: C.purple, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{j + 1}</div>
                  <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>{step}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {relatedFeatures.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Related features</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {relatedFeatures.map(f => (
              <Link key={f.slug} href={`/docs/features/${f.slug}`} style={{ fontSize: 12.5, fontWeight: 600, color: C.purple, background: C.purpleBg, borderRadius: 20, padding: '6px 14px', textDecoration: 'none' }}>
                {f.title} →
              </Link>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => router.push('/setup')} style={{ background: C.purple, color: C.white, border: 'none', borderRadius: 11, padding: '13px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Start your free trial →
      </button>
    </div>
  );
}
