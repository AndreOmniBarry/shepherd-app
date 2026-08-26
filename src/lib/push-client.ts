'use client';

// Client-side half of Web Push — turns a granted Notification permission
// into an actual subscription the server can push to. Kept separate from
// notify-feedback.ts (the in-tab chime/haptic) since this one talks to
// the network and the service worker instead of just the Web Audio API.

// applicationServerKey must be a Uint8Array, not the base64url string the
// server hands out — this is the standard conversion boilerplate for it.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export type SubscribeResult = { ok: true } | { ok: false; reason: string };

/**
 * Subscribes this browser to push (reusing an existing subscription if
 * one is already active) and registers it with the server. Safe to call
 * whenever permission is already 'granted' — both the browser's own
 * getSubscription() and the server's upsert (on_conflict=endpoint) are
 * idempotent, so calling this again on every app load is harmless and is
 * what re-links a subscription if the DB row was ever lost independently
 * of the browser's own grant (a fresh database, a cleared table, etc).
 *
 * Returns a reason string on failure (surfaced in NotificationBell while
 * this feature is new) instead of just swallowing it — a silent boolean
 * was undebuggable the moment something broke, since nothing else in this
 * flow can throw a visible error either.
 */
export async function subscribeToPush(): Promise<SubscribeResult> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return { ok: false, reason: 'No service worker support in this browser' };
    if (!('PushManager' in window)) return { ok: false, reason: 'No Push API support in this browser' };
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return { ok: false, reason: 'VAPID key not configured on this deploy' };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      } catch (err) {
        return { ok: false, reason: `subscribe() failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys) return { ok: false, reason: 'Subscription had no endpoint/keys' };

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, reason: `Server rejected subscription (${res.status}): ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
