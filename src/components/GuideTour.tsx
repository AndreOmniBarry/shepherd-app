'use client';
import { useState, useEffect } from 'react';
import Icon from '@/components/Icon';
import GuideMockup, { type GuideTheme } from '@/components/GuideMockup';
import { GUIDE_CONTENT, PORTAL_TITLE, type PortalKey } from '@/lib/guide-content';

const STORAGE_PREFIX = 'shepherd_guide_seen_';

// Whether this browser has already dismissed (skipped or finished) the
// first-time tour for this portal. Starts false on every render (server
// and first client render agree, so there's no hydration mismatch) and
// flips true from a useEffect once localStorage has actually been read.
export function useFirstVisitGuide(portalKey: PortalKey): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_PREFIX + portalKey);
      if (!seen) setOpen(true);
    } catch { /* localStorage unavailable — just don't auto-show */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalKey]);
  return [open, setOpen];
}

function markSeen(portalKey: PortalKey) {
  try { window.localStorage.setItem(STORAGE_PREFIX + portalKey, '1'); } catch { /* ignore */ }
}

// The first-time (or replayed) walkthrough — a single centered card that
// steps through every feature of the current portal. Deliberately NOT
// anchored to real on-screen elements (no floating tooltip pointing at a
// live button): a self-contained, viewport-capped modal can never overflow
// or drift off-screen on a small phone the way an anchored tooltip can —
// this is what "nothing floating or cross extending" actually requires.
export default function GuideTour({ portalKey, t, open, onClose }: {
  portalKey: PortalKey; t: GuideTheme; open: boolean; onClose: () => void;
}) {
  const entries = GUIDE_CONTENT[portalKey] || [];
  const [step, setStep] = useState(-1); // -1 = welcome slide, 0..n-1 = feature slides

  useEffect(() => { if (open) setStep(-1); }, [open]);

  if (!open) return null;

  function finish() {
    markSeen(portalKey);
    onClose();
  }

  const isWelcome = step === -1;
  const entry = !isWelcome ? entries[step] : null;
  const total = entries.length;

  return (
    <div
      role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(8,6,20,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={finish}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto',
          background: t.card, borderRadius: 18, border: `0.5px solid ${t.border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: t.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.purple, flexShrink: 0 }}>
            <Icon name={isWelcome ? 'ti-rocket' : entry!.icon} size={17} strokeWidth={2} />
          </div>
          <button onClick={finish} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', padding: 4 }} aria-label="Skip tour">
            <Icon name="ti-x" size={16} strokeWidth={2} />
          </button>
        </div>

        <div style={{ padding: '14px 22px 4px' }}>
          {isWelcome ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 8 }}>Welcome to {PORTAL_TITLE[portalKey]}</div>
              <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.6, marginBottom: 4 }}>
                Here's a quick walkthrough of everything you can do here — {total} short stops, and you can skip at any time. You can replay this anytime from the Guide button in your menu.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: t.purple, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                {step + 1} of {total}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 6 }}>{entry!.title}</div>
              <div style={{ fontSize: 13, color: t.sub, lineHeight: 1.55, marginBottom: 12 }}>{entry!.blurb}</div>
              <div style={{ marginBottom: 4 }}>
                <GuideMockup kind={entry!.mockup} labels={entry!.mockupLabels} t={t} />
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '14px 22px 20px', marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 14 }}>
            {Array.from({ length: total + 1 }).map((_, i) => (
              <div key={i} style={{ width: (i === step + 1) ? 16 : 5, height: 5, borderRadius: 3, background: i === step + 1 ? t.purple : t.border, transition: 'all 0.15s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isWelcome && (
              <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, background: 'transparent', color: t.sub, border: `0.5px solid ${t.border}`, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Back
              </button>
            )}
            <button
              onClick={() => (step === total - 1 ? finish() : setStep(s => s + 1))}
              style={{ flex: 2, background: t.purple, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {isWelcome ? 'Start tour' : step === total - 1 ? 'Done' : 'Next'}
            </button>
          </div>
          {isWelcome && (
            <button onClick={finish} style={{ width: '100%', background: 'transparent', border: 'none', color: t.muted, fontSize: 12, padding: '10px 0 0', cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
