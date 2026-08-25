import webpush from 'web-push';

// ── Real OS-level push, on top of the existing in-tab chime ────────────
// NotificationBell already plays a sound + shows a badge while a tab is
// open, and can fire a same-tab `new Notification(...)` when that tab is
// merely backgrounded — but neither reaches a user whose browser isn't
// running at all (app closed, phone locked). That requires the actual
// Web Push protocol: a subscription registered once from the client
// (see /api/push/subscribe) that lets a server push a message through
// the browser vendor's push service without the page being open.
//
// This file is the one place that talks to that protocol, so every
// existing call site that already creates notifications (notifyMany,
// notifyUsers, dispatchEvent — see notify.ts) gets real push for free by
// calling sendPushToUsers alongside its DB insert, with zero changes
// needed anywhere else in the app.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@justshephrd.com';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

async function getSubscriptionsForUsers(userIds: string[]): Promise<PushSubscriptionRow[]> {
  if (userIds.length === 0) return [];
  const list = userIds.map(id => `"${id}"`).join(',');
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${list})&select=id,endpoint,p256dh,auth`,
      { headers: hdrs() }
    );
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function deleteSubscription(id: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`, { method: 'DELETE', headers: hdrs() });
  } catch { /* best-effort cleanup — a stale row just fails silently again next time */ }
}

export interface PushMessage {
  title: string;
  body: string;
  link?: string;
}

/**
 * Push the same message to every device a set of users has subscribed
 * from. Never throws — push is always a side-effect of a notification
 * that's already been written to the DB, so a delivery failure (offline
 * device, revoked permission, VAPID not configured yet) must never
 * surface to the caller. A 404/410 from the push service means that
 * subscription is permanently gone (uninstalled, permission revoked) —
 * those rows are deleted so future sends stop wasting a round-trip on
 * them.
 */
export async function sendPushToUsers(userIds: string[], message: PushMessage): Promise<void> {
  if (!ensureConfigured()) return; // VAPID keys not set up yet — silently skip, chime/badge still work
  try {
    const subs = await getSubscriptionsForUsers([...new Set(userIds.filter(Boolean))]);
    if (subs.length === 0) return;
    const payload = JSON.stringify({ title: message.title, body: message.body, link: message.link || '/dashboard' });
    await Promise.allSettled(subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) await deleteSubscription(sub.id);
        else console.error('[sendPushToUsers] delivery failed:', statusCode, err);
      }
    }));
  } catch (err) {
    console.error('[sendPushToUsers] failed:', err);
  }
}
