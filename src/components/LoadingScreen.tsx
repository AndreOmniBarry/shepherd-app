'use client';

// Full-screen loading state for page opens and heavy transitions — replaces
// a bare "Loading…" string with the same glass/motion language as the rest
// of the redesign: a soft radial backdrop, an orbiting ring around the
// SHEP.HERD mark, and staggered pulsing dots instead of a static spinner.
export default function LoadingScreen({ label = 'Loading…', dark = false }: { label?: string; dark?: boolean }) {
  const bg = dark ? '#080614' : '#F0EFF8';
  const accent = dark ? '#A89FFF' : '#534AB7';
  const text = dark ? 'rgba(232,229,255,0.6)' : '#5A5180';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: `radial-gradient(circle at 50% 40%, ${dark ? 'rgba(83,74,183,0.16)' : 'rgba(83,74,183,0.08)'}, transparent 55%), ${bg}` }}>
      <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="shep-loading-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2.5px solid ${dark ? 'rgba(168,159,255,0.15)' : 'rgba(83,74,183,0.12)'}`, borderTopColor: accent }} />
        <div style={{ width: 28, height: 28, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 4, height: 22, background: accent, borderRadius: 2 }} />
          <div style={{ position: 'absolute', width: 15, height: 4, background: accent, borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="shep-loading-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: text, fontWeight: 500 }}>{label}</div>
    </div>
  );
}
