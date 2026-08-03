'use client';
import { useEffect, useState } from 'react';

const SEEN_KEY = 'shepherd-splash-seen';
const LETTERS = ['S', 'H', 'E', 'P', '.', 'H', 'E', 'R', 'D'];

// One-time cinematic intro for the public marketing site — a lightning
// strike that ignites the SHEP.HERD mark, a shockwave ring, then the
// wordmark assembling letter by letter. Plays once per browser session
// (sessionStorage-gated) so repeat visitors during the same session never
// wait on it twice, and is skipped entirely under prefers-reduced-motion.
export default function SplashIntro() {
  const [phase, setPhase] = useState<'boot' | 'skip'>('boot');
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem(SEEN_KEY) === 'true'; } catch { /* storage unavailable — just play it */ }
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (alreadySeen || reduced) {
      setPhase('skip');
      return;
    }
    // The "seen" flag is written only once the animation actually finishes,
    // not immediately on mount — React 18 Strict Mode (dev only) mounts,
    // cleans up, and remounts every effect once as a bug check. Writing the
    // flag eagerly meant that harmless remount's cleanup never got to
    // reverse it, so the real (second) mount saw "already seen" and skipped
    // the splash before it ever played.
    const exitTimer = setTimeout(() => setExiting(true), 2000);
    const doneTimer = setTimeout(() => {
      try { sessionStorage.setItem(SEEN_KEY, 'true'); } catch { /* non-fatal */ }
      setPhase('skip');
    }, 2500);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, []);

  if (!mounted || phase === 'skip') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0A0618',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      {/* Bolt streak */}
      <svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
        <path
          d="M 40 40 L 190 170 L 150 170 L 300 320"
          fill="none" stroke="#A89FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="sp-bolt"
        />
      </svg>

      {/* Strike flash */}
      <div className="sp-flash" style={{ position: 'absolute', inset: 0, background: '#FFFFFF' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        {/* Shockwave rings + mark */}
        <div style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="sp-shock" style={{ position: 'absolute', width: 30, height: 30, borderRadius: '50%', border: '1.6px solid #A89FFF' }} />
          <div className="sp-shock" style={{ position: 'absolute', width: 30, height: 30, borderRadius: '50%', border: '1.6px solid #2DD4AA', animationDelay: '0.12s' }} />
          <div className="sp-mark" style={{ position: 'relative', width: 44, height: 44, background: '#534AB7', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 0 rgba(168,159,255,0)' }}>
            <div style={{ position: 'absolute', width: 5, height: 24, background: '#fff', borderRadius: 2.5 }} />
            <div style={{ position: 'absolute', width: 24, height: 5, background: '#fff', borderRadius: 2.5 }} />
          </div>
        </div>

        {/* Wordmark cascade */}
        <div style={{ display: 'flex' }}>
          {LETTERS.map((ch, i) => (
            <span
              key={i}
              className="sp-letter"
              style={{
                display: 'inline-block', fontSize: 26, fontWeight: 800, letterSpacing: '1px',
                color: '#F4F3FB', animationDelay: `${0.75 + i * 0.045}s`,
                width: ch === '.' ? 8 : undefined, textAlign: 'center',
              }}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        .sp-bolt {
          stroke-dasharray: 520;
          stroke-dashoffset: 520;
          animation: sp-draw 0.5s cubic-bezier(0.3,0.8,0.4,1) 0.15s forwards;
          filter: drop-shadow(0 0 6px rgba(168,159,255,0.8));
        }
        @keyframes sp-draw { to { stroke-dashoffset: 0; } }

        .sp-flash {
          opacity: 0;
          animation: sp-flash-pulse 0.35s ease-out 0.6s;
        }
        @keyframes sp-flash-pulse { 0% { opacity: 0; } 35% { opacity: 0.85; } 100% { opacity: 0; } }

        .sp-shock {
          opacity: 0;
          animation: sp-shock-out 0.7s cubic-bezier(0.2,0.6,0.35,1) 0.62s;
        }
        @keyframes sp-shock-out {
          0%   { width: 10px; height: 10px; opacity: 0.9; }
          100% { width: 110px; height: 110px; opacity: 0; }
        }

        .sp-mark {
          animation: sp-ignite 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.58s backwards;
        }
        @keyframes sp-ignite {
          0%   { transform: scale(0.4); box-shadow: 0 0 0 0 rgba(168,159,255,0); }
          55%  { transform: scale(1.15); box-shadow: 0 0 32px 8px rgba(168,159,255,0.75); }
          100% { transform: scale(1); box-shadow: 0 0 16px 2px rgba(168,159,255,0.35); }
        }

        .sp-letter {
          opacity: 0;
          transform: translateY(10px);
          animation: sp-letter-in 0.4s ease-out both;
        }
        @keyframes sp-letter-in {
          0%   { opacity: 0; transform: translateY(10px); text-shadow: 0 0 0 rgba(168,159,255,0); }
          60%  { text-shadow: 0 0 14px rgba(168,159,255,0.9); }
          100% { opacity: 1; transform: translateY(0); text-shadow: 0 0 0 rgba(168,159,255,0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sp-bolt, .sp-flash, .sp-shock, .sp-mark, .sp-letter { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
