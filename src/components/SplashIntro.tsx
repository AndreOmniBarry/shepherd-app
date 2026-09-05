'use client';
import { useEffect, useState } from 'react';

const LETTERS = ['S', 'H', 'E', 'P', '.', 'H', 'E', 'R', 'D'];

// Cinematic intro for the public marketing site only — a flash traces the
// outline around the SHEP.HERD mark (Supabase-style logo reveal, contained
// to the icon instead of a streak across the whole screen), a shockwave
// ring, then the wordmark assembling letter by letter. This component only
// ever lives on the landing page, so it replays on every visit rather than
// being session-gated — it's the showcase, not a loading screen people need
// to get past. Skipped entirely under prefers-reduced-motion.
export default function SplashIntro() {
  const [phase, setPhase] = useState<'boot' | 'skip'>('boot');
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPhase('skip');
      return;
    }
    const exitTimer = setTimeout(() => setExiting(true), 3200);
    const doneTimer = setTimeout(() => setPhase('skip'), 3900);
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
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      {/* Ambient strike flash — soft, whole-screen camera-flash pulse */}
      <div className="sp-flash" style={{ position: 'absolute', inset: 0, background: '#FFFFFF' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        {/* Outline trace + shockwave rings + mark */}
        <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* A flash traces the outline around the mark, like a current
              circling it, rather than a bolt streaking across the screen. */}
          <svg width="96" height="96" viewBox="0 0 96 96" style={{ position: 'absolute', inset: 0 }}>
            <rect
              x="6" y="6" width="84" height="84" rx="22"
              fill="none" stroke="#A89FFF" strokeWidth="2.5" strokeLinecap="round"
              className="sp-outline"
            />
          </svg>
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
                color: '#F4F3FB', animationDelay: `${0.85 + i * 0.075}s`,
                width: ch === '.' ? 8 : undefined, textAlign: 'center',
              }}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>

      {/* dangerouslySetInnerHTML, not {`...`} — see the identical fix
          (and full explanation) in src/app/page.tsx's own <style> block;
          same footgun, just not currently tripped here since this CSS
          has no apostrophes/quotes yet. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .sp-outline {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: sp-draw 0.5s cubic-bezier(0.3,0.8,0.4,1) 0.15s forwards;
          filter: drop-shadow(0 0 8px rgba(168,159,255,0.9));
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
          animation: sp-letter-in 0.5s ease-out both;
        }
        @keyframes sp-letter-in {
          0%   { opacity: 0; transform: translateY(10px); text-shadow: 0 0 0 rgba(168,159,255,0); }
          60%  { text-shadow: 0 0 14px rgba(168,159,255,0.9); }
          100% { opacity: 1; transform: translateY(0); text-shadow: 0 0 0 rgba(168,159,255,0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sp-outline, .sp-flash, .sp-shock, .sp-mark, .sp-letter { animation: none; opacity: 1; }
        }
      ` }} />
    </div>
  );
}
