'use client';
import { useState, useEffect } from 'react';

// Full-screen loading state for page opens and heavy transitions. Two
// motion variants — "Relay Bounce" (dots drop in and settle one at a
// time) and "Ripple Gather" (rings expand outward from a fixed center)
// — picked at random per mount so the screen doesn't feel identical on
// every load, while staying visually consistent (same brand palette,
// same anchor mark) so it still reads as one considered design.
//
// The random pick can't happen in useState's initializer — that function
// runs once during the server render AND once again, independently,
// during the client's initial hydration render, so Math.random() gave a
// real ~50% chance the two disagreed: server renders "shep-relay-dot",
// client hydrates expecting "shep-ripple-ring" (or vice versa), and React
// throws a genuine "Prop `className` did not match" hydration error —
// caught live via run-shepherd-app's driver on /dashboard. Fix: always
// render the same variant ('relay') for both the server render and the
// client's first render (so they agree — no mismatch possible), then
// reroll randomly in an effect, which only ever runs after hydration is
// already done and is just a normal client-side state update from there.
export default function LoadingScreen({ label = 'Loading…', dark = false }: { label?: string; dark?: boolean }) {
  const [variant, setVariant] = useState<'relay' | 'ripple'>('relay');
  useEffect(() => { setVariant(Math.random() < 0.5 ? 'relay' : 'ripple'); }, []);

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
