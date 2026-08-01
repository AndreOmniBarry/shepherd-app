'use client';

// Full-screen loading state for page opens and heavy transitions. Replaces
// the earlier spinning-ring design (didn't read as premium) with a soft
// breathing glow halo behind the SHEP.HERD mark and an indeterminate
// gradient progress bar — no rotation, just a gentle pulse and a sweep,
// closer to what a modern native app's launch screen feels like.
export default function LoadingScreen({ label = 'Loading…', dark = false }: { label?: string; dark?: boolean }) {
  const bg = dark ? '#080614' : '#F0EFF8';
  const accent = dark ? '#A89FFF' : '#534AB7';
  const accent2 = dark ? '#2DD4AA' : '#1D9E75';
  const text = dark ? 'rgba(232,229,255,0.6)' : '#5A5180';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, background: `radial-gradient(circle at 50% 40%, ${dark ? 'rgba(83,74,183,0.16)' : 'rgba(83,74,183,0.08)'}, transparent 55%), ${bg}` }}>
      <div style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="shep-loading-halo" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, ${dark ? 'rgba(168,159,255,0.35)' : 'rgba(83,74,183,0.22)'} 0%, transparent 70%)` }} />
        <div style={{ width: 28, height: 28, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <div style={{ position: 'absolute', width: 4, height: 22, background: accent, borderRadius: 2 }} />
          <div style={{ position: 'absolute', width: 15, height: 4, background: accent, borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ width: 130, height: 3, borderRadius: 2, overflow: 'hidden', background: dark ? 'rgba(168,159,255,0.12)' : 'rgba(83,74,183,0.1)', position: 'relative' }}>
        <div className="shep-loading-bar-fill" style={{ position: 'absolute', inset: 0, width: '40%', borderRadius: 2, background: `linear-gradient(90deg, transparent, ${accent}, ${accent2}, transparent)` }} />
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
