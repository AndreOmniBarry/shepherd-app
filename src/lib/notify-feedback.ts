// Shared sound + haptic feedback for anything that wants to announce new
// content arriving in near-real-time (notifications, chat messages).

// Short, synthesized two-tone chime — no audio asset to ship or fail to
// load. Built fresh each call since AudioContext can't be reused after a
// tab has been backgrounded on some browsers.
export function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.09 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch { /* Web Audio unavailable — silently skip, no sound is not a failure */ }
}

// Vibration API — Android Chrome supports it; iOS Safari does not expose
// any web API for haptics at all (Apple restricts that to native apps),
// so this is a no-op there rather than a broken promise.
export function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(35);
}
