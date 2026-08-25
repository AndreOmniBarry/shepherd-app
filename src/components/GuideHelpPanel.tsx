'use client';
import { useState } from 'react';
import Icon from '@/components/Icon';
import GuideMockup, { type GuideTheme } from '@/components/GuideMockup';
import { GUIDE_CONTENT, PORTAL_TITLE, type PortalKey } from '@/lib/guide-content';

// The permanent "come back and learn your way around anytime" reference —
// unlike GuideTour (a one-pass walkthrough), every entry here stays open
// for browsing: the plain-English steps ("go here, tap this next") plus
// the same on-brand mockup used in the tour in place of instructional
// video. A full-screen overlay rather than a side panel, so it's exactly
// as safe on a phone as GuideTour — no anchored positioning to overflow.
export default function GuideHelpPanel({ portalKey, t, onClose, onReplayTour, visibleIds }: {
  portalKey: PortalKey; t: GuideTheme; onClose: () => void; onReplayTour: () => void;
  // See GuideTour's visibleIds comment — same allow-list, kept in sync so
  // the permanent reference never lists a feature the tour also hides.
  visibleIds?: string[];
}) {
  const allEntries = GUIDE_CONTENT[portalKey] || [];
  const entries = visibleIds ? allEntries.filter(e => visibleIds.includes(e.id)) : allEntries;
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null);

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1150, background: t.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px', borderBottom: `0.5px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.sub, cursor: 'pointer', display: 'flex', padding: 4 }} aria-label="Close guide">
          <Icon name="ti-x" size={18} strokeWidth={2.2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>How to use {PORTAL_TITLE[portalKey]}</div>
          <div style={{ fontSize: 11.5, color: t.muted }}>Tap any feature below to see how it works</div>
        </div>
        <button onClick={onReplayTour} style={{ background: t.purpleBg, color: t.purple, border: 'none', borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Replay tour
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 40px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map(e => {
            const isOpen = openId === e.id;
            return (
              <div key={e.id} style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 13, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenId(isOpen ? null : e.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: t.purpleBg, color: t.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={e.icon} size={15} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{e.title}</div>
                    <div style={{ fontSize: 11.5, color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.blurb}</div>
                  </div>
                  <Icon name="ti-chevron-down" size={15} strokeWidth={2} />
                </button>
                {isOpen && (
                  <div style={{ padding: '0 15px 16px' }}>
                    {/* Pure-CSS reflow (flex-wrap + a min basis) instead of a
                        JS viewport check — window.matchMedia would crash
                        during server-side rendering, and this way the
                        layout adapts on resize with no listener needed. */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.purple, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Steps</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {e.steps.map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: t.sub, lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 700, color: t.purple, flexShrink: 0 }}>{i + 1}.</span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ flex: '1 1 220px', maxWidth: 280 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Preview</div>
                        <GuideMockup kind={e.mockup} labels={e.mockupLabels} t={t} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
