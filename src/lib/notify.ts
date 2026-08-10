import { currencySymbol } from '@/lib/currency';

// ── Shared notification plumbing ──────────────────────────────────────
// Two layers:
//   1. Low-level insert helpers (notifyUsers / notifyMany / notifyUsersChecked)
//      — every route in the app that writes to the `notifications` table
//      goes through one of these instead of hand-rolling its own fetch.
//   2. dispatchEvent() — the original "event type → role-based recipients
//      + title/body" fan-out, moved here from notify/dispatch/route.ts so
//      internal callers can invoke it as a function instead of making an
//      HTTP round-trip to themselves. /api/notify/dispatch is now a thin
//      HTTP wrapper around dispatchEvent() for any external/webhook caller.
//
// Failure handling is standardized here: a notification is always a
// side-effect of something that already succeeded (the attendance record,
// the prayer request, the roster, ...), so a failure to notify must never
// fail the parent request. notifyUsers/notifyMany never throw — they log
// via console.error and resolve. The one exception is notifyUsersChecked,
// for the rare case (recognition/commend) where the notification row IS
// the primary thing being created, not a side effect of something else —
// there, the caller needs to know if the write failed so it can tell the
// user, exactly as it did before this consolidation.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export interface NotificationContent {
  type: string;
  title: string;
  body: string;
  link?: string;
}

interface NotifyRow {
  userId: string;
  content: NotificationContent;
}

function toRow(r: NotifyRow, churchId: string | null | undefined) {
  return {
    user_id: r.userId,
    type: r.content.type,
    title: r.content.title,
    body: r.content.body,
    link: r.content.link ?? null,
    read: false,
    church_id: churchId || null,
  };
}

/**
 * Insert one notification per row, each with its own (possibly distinct)
 * title/body — e.g. a published roster where every member's body names
 * their own role. Never throws; logs and swallows failures.
 */
export async function notifyMany(rows: NotifyRow[], churchId: string | null | undefined): Promise<void> {
  const filtered = rows.filter(r => r.userId);
  if (filtered.length === 0) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(filtered.map(r => toRow(r, churchId))),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[notifyMany] insert failed:', res.status, errText);
    }
  } catch (err) {
    console.error('[notifyMany] failed:', err);
  }
}

/**
 * Insert the same notification content for a list of user ids (deduped).
 * The common case — one event, one message, many recipients. Never
 * throws; logs and swallows failures so the caller's own response is
 * never affected by a notification failure.
 */
export async function notifyUsers(userIds: string[], content: NotificationContent, churchId: string | null | undefined): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  return notifyMany(unique.map(userId => ({ userId, content })), churchId);
}

/**
 * Same as notifyUsers, but reports success/failure instead of swallowing
 * it. Only for the rare case where the notification row is the primary
 * thing the endpoint creates (e.g. recognition/commend has no separate
 * "commendation" table — the notifications row is the whole deliverable),
 * so a write failure genuinely needs to reach the caller as an error.
 */
export async function notifyUsersChecked(
  userIds: string[],
  content: NotificationContent,
  churchId: string | null | undefined
): Promise<{ ok: boolean; error?: string }> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return { ok: true };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: { ...hdrs(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(unique.map(userId => toRow({ userId, content }, churchId))),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[notifyUsersChecked] insert failed:', res.status, errText);
    let detail = '';
    try { detail = JSON.parse(errText)?.message || ''; } catch { /* not JSON */ }
    return { ok: false, error: detail };
  }
  return { ok: true };
}

// ── Event-type dispatch (unchanged logic, moved from notify/dispatch) ──

async function getCurrency(churchId: string | null | undefined): Promise<string> {
  if (!churchId) return 'NGN';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${churchId}&limit=1&select=currency`, { headers: hdrs() });
    const configs = await res.json();
    return (Array.isArray(configs) && configs[0]?.currency) || 'NGN';
  } catch { return 'NGN'; }
}

export type NotifyEvent =
  | 'attendance_submitted'
  | 'giving_submitted'
  | 'first_timer_logged'
  | 'care_lead_created'
  | 'income_logged'
  | 'requisition_raised'
  | 'requisition_approved'
  | 'partnership_giving_logged'
  | 'prayer_request_submitted'
  | 'member_added';

export interface DispatchPayload {
  event: NotifyEvent;
  actor_name: string;
  actor_role: string;
  church_id: string | null | undefined;
  fellowship_id?: string;
  cell_name?: string;
  fellowship_name?: string;
  department_name?: string;
  detail: string;
  amount?: number;
}

async function getRecipients(payload: DispatchPayload): Promise<string[]> {
  const ids = new Set<string>();
  // A missing church_id means the caller wasn't updated to pass one yet —
  // fail closed to "notify nobody" rather than falling back to a global
  // query that would fan out across every church.
  if (!payload.church_id) return [];
  const churchFilter = `&church_id=eq.${payload.church_id}`;

  // Always notify overseer and PA for every event
  const adminRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa)&is_active=eq.true${churchFilter}&select=id`,
    { headers: hdrs() }
  );
  const admins = await adminRes.json();
  if (Array.isArray(admins)) admins.forEach((u: Record<string, string>) => ids.add(u.id));

  // Fellowship head for fellowship-scoped events
  if (payload.fellowship_id && ['attendance_submitted', 'giving_submitted', 'first_timer_logged', 'care_lead_created'].includes(payload.event)) {
    const felRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.fellowship_head&fellowship_id=eq.${payload.fellowship_id}&is_active=eq.true${churchFilter}&select=id`,
      { headers: hdrs() }
    );
    const felHeads = await felRes.json();
    if (Array.isArray(felHeads)) felHeads.forEach((u: Record<string, string>) => ids.add(u.id));
  }

  // Care team for absence-related events
  if (['care_lead_created', 'first_timer_logged'].includes(payload.event)) {
    const careRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.care_team&is_active=eq.true${churchFilter}&select=id`,
      { headers: hdrs() }
    );
    const care = await careRes.json();
    if (Array.isArray(care)) care.forEach((u: Record<string, string>) => ids.add(u.id));
  }

  // Accounts for financial events
  if (['income_logged', 'giving_submitted', 'partnership_giving_logged'].includes(payload.event)) {
    const accRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.accounts&is_active=eq.true${churchFilter}&select=id`,
      { headers: hdrs() }
    );
    const acc = await accRes.json();
    if (Array.isArray(acc)) acc.forEach((u: Record<string, string>) => ids.add(u.id));
  }

  // Partnership for partnership events
  if (payload.event === 'partnership_giving_logged') {
    const partRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.partnership&is_active=eq.true${churchFilter}&select=id`,
      { headers: hdrs() }
    );
    const part = await partRes.json();
    if (Array.isArray(part)) part.forEach((u: Record<string, string>) => ids.add(u.id));
  }

  return Array.from(ids);
}

async function buildNotification(payload: DispatchPayload): Promise<NotificationContent> {
  switch (payload.event) {
    case 'attendance_submitted':
      return {
        type: 'attendance',
        title: `Attendance submitted — ${payload.cell_name || payload.fellowship_name || 'Unknown'}`,
        body: payload.detail,
      };
    case 'giving_submitted':
      return {
        type: 'giving',
        title: `Giving recorded — ${payload.fellowship_name || 'Fellowship'}`,
        body: payload.detail,
      };
    case 'first_timer_logged':
      return {
        type: 'pipeline',
        title: 'First timer logged',
        body: payload.detail,
      };
    case 'care_lead_created':
      return {
        type: 'pipeline',
        title: 'Care lead created',
        body: payload.detail,
      };
    case 'income_logged':
      return {
        type: 'giving',
        title: `Income recorded${payload.amount ? ` — ${currencySymbol(await getCurrency(payload.church_id))}${payload.amount.toLocaleString()}` : ''}`,
        body: payload.detail,
      };
    case 'requisition_raised':
      return {
        type: 'pastoral',
        title: 'Expense request submitted',
        body: payload.detail,
      };
    case 'requisition_approved':
      return {
        type: 'pastoral',
        title: 'Expense request approved',
        body: payload.detail,
      };
    case 'partnership_giving_logged':
      return {
        type: 'giving',
        title: `Partnership giving logged${payload.amount ? ` — ${currencySymbol(await getCurrency(payload.church_id))}${payload.amount.toLocaleString()}` : ''}`,
        body: payload.detail,
      };
    case 'prayer_request_submitted':
      return {
        type: 'pastoral',
        title: 'New prayer request',
        body: payload.detail,
      };
    case 'member_added':
      return {
        type: 'pipeline',
        title: 'New member addition request',
        body: payload.detail,
      };
    default:
      return { type: 'system', title: 'New activity', body: payload.detail };
  }
}

/**
 * Central event-type dispatcher — computes recipients by role for the
 * given event, builds its title/body, and inserts via notifyMany. Never
 * throws (same "never fail the parent request" contract as notifyUsers).
 * Used directly by the handful of routes whose recipient logic already
 * matches this generic "overseer/PA always, plus role X for event Y"
 * model (attendance, income, requisitions, partnership giving), and via
 * HTTP through /api/notify/dispatch for any external/webhook caller.
 */
export async function dispatchEvent(payload: DispatchPayload): Promise<{ sent: number }> {
  try {
    const recipients = await getRecipients(payload);
    if (recipients.length === 0) return { sent: 0 };
    const notif = await buildNotification(payload);
    await notifyUsers(recipients, notif, payload.church_id);
    return { sent: recipients.length };
  } catch (err) {
    console.error('[dispatchEvent]', err);
    return { sent: 0 };
  }
}
