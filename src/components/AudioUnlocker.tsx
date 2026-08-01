'use client';
import { useEffect } from 'react';
import { unlockAudio } from '@/lib/notify-feedback';

// Mounted once at the root. Browsers won't let a background poll (a new
// chat message, a new notification) start audio on its own — it takes a
// real user gesture. This grabs the very first click/touch/key of the
// session and uses it to unlock the shared AudioContext, so later
// notification chimes triggered by polling actually play.
export default function AudioUnlocker() {
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  return null;
}
