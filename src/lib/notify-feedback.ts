// Shared sound + haptic feedback for anything that wants to announce new
// content arriving in near-real-time (notifications, chat messages).

// A fresh AudioContext starts "suspended" under browser autoplay policy
// and only unlocks once a real user gesture resumes it — polling-detected
// events (new chat message, new notification) don't count as a gesture,
// so a context created on-demand inside playNotificationSound() would
// silently never produce sound. Keeping one shared context and unlocking
// it from an actual click/touch/key elsewhere in the app (see
// AudioUnlocker) means later calls from background polling can use it.
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!sharedCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedCtx = new Ctx();
    }
    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch {
    return null;
  }
}

// Called once from a real user gesture (see AudioUnlocker) so the shared
// context is already running by the time a background poll wants sound.
export function unlockAudio() {
  getCtx();
}

// Short, synthesized two-tone chime — no audio asset to ship or fail to load.
export function playNotificationSound() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
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
  } catch { /* Web Audio unavailable — silently skip, no sound is not a failure */ }
}

// Vibration API — Android Chrome supports it; iOS Safari does not expose
// any web API for haptics at all (Apple restricts that to native apps),
// so this is a no-op there rather than a broken promise.
export function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(35);
}
