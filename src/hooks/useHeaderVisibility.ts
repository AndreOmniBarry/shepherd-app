'use client';
import { useEffect, useRef, useState } from 'react';

// Shared "auto-hide topbar on scroll down, reveal on scroll up" behavior —
// replaces plain position:sticky, which reports were seeing fail to stay
// visible while scrolling (position:sticky is notoriously fragile across
// browsers/OSes the moment any ancestor's layout shifts under it — a flex
// child resizing, a mobile browser's own chrome collapsing, etc.). A
// position:fixed header driven by an explicit scroll listener sidesteps all
// of that: it's never dependent on an ancestor's box being exactly right.
//
// - Ignores jitter: only reacts once scroll has moved past THRESHOLD_PX in
//   one direction, so a few px of rubber-banding/trackpad noise doesn't
//   flicker the header.
// - Never hides near the top: staying visible until PIN_TOP_PX keeps the
//   header present when a page opens or is scrolled back near the start,
//   rather than requiring a deliberate upward scroll first.
const THRESHOLD_PX = 8;
const PIN_TOP_PX = 24;

export function useHeaderVisibility() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y <= PIN_TOP_PX) {
        setHidden(false);
      } else if (delta > THRESHOLD_PX) {
        setHidden(true);
        lastY.current = y;
      } else if (delta < -THRESHOLD_PX) {
        setHidden(false);
        lastY.current = y;
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return hidden;
}
