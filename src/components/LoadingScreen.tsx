'use client';
import { useState } from 'react';

// Full-screen loading state for page opens and heavy transitions. Two
// motion variants — "Relay Bounce" (dots drop in and settle one at a
// time) and "Ripple Gather" (rings expand outward from a fixed center)
// — picked at random per mount so the screen doesn't feel identical on
// every load, while staying visually consistent (same brand palette,
// same anchor mark) so it still reads as one considered design.
export default function LoadingScreen({ label = 'Loading…', dark = false }: { label?: string; dark?: boolean }) {
  const [variant] = useState<'relay' | 'ripple'>(() => Math.random() < 0.5 ? 'relay' : 'ripple');

  const bg = dark ? '#080614' : '#F0EFF8';
  const purple = dark ? '#A89FFF' : '#534AB7';
  const teal = dark ? '#2DD4AA' : '#1D9E75';
  const amber = dark ? '#FCD34D' : '#BA7517';
  const coral = dark ? '#F87171' : '#D85A30';
  const text = dark ? 'rgba(232,229,255,0.6)' : '#5A5180';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, background: `radial-gradient(circle at 50% 40%, ${dark ? 'rgba(83,74,183,0.16)' : 'rgba(83,74,183,0.08)'}, transparent 55%), ${bg}` }}>
      <div style={{ width: 24, height: 24, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', width: 3, height: 17, background: purple, borderRadius: 2 }} />
        <div style={{ position: 'absolute', width: 12, height: 3, background: purple, borderRadius: 2 }} />
      </div>

      {variant === 'relay' ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', height: 46 }}>
          {[purple, teal, amber, coral].map((c, i) => (
            <div key={i} className="shep-relay-dot" style={{ width: 13, height: 13, borderRadius: '50%', background: c, animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      ) : (
        <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="shep-ripple-ring" style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', border: `1.6px solid ${purple}`, animationDelay: '0s' }} />
          <div className="shep-ripple-ring" style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', border: `1.6px solid ${teal}`, animationDelay: '0.8s' }} />
          <div className="shep-ripple-ring" style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', border: `1.6px solid ${amber}`, animationDelay: '1.6s' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: purple, zIndex: 1, boxShadow: `0 0 10px 2px ${dark ? 'rgba(168,159,255,0.5)' : 'rgba(83,74,183,0.35)'}` }} />
        </div>
      )}

      <div style={{ fontSize: 12, color: text, fontWeight: 500 }}>{label}</div>
    </div>
  );
}
