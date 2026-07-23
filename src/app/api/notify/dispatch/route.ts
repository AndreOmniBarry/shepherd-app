import { NextResponse } from 'next/server';

// ── Central notification dispatcher
// ── Called internally by every submission route
// ── Fires to all responsible parties based on event type

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

type NotifyEvent =
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

interface DispatchPayload {
  event: NotifyEvent;
  actor_name: string;
  actor_role: string;
  fellowship_id?: string;
  cell_name?: string;
  fellowship_name?: string;
  department_name?: string;
  detail: string;
  amount?: number;
}

async function getRecipients(payload: DispatchPayload): Promise<string[]> {
  const ids = new Set<string>();

  // Always notify overseer and PA for every event
  const adminRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?role=in.(overseer,pa)&is_active=eq.true&select=id`,
    { headers: hdrs() }
  );
  const admins = await adminRes.json();
  if (Array.isArray(admins)) admins.forEach((u: Record<string, string>) => ids.add(u.id));

  // Fellowship head for fellowship-scoped events
  if (payload.fellowship_id && ['attendance_submitted', 'giving_submitted', 'first_timer_logged', 'care_lead_created'].includes(payload.event)) {
    const felRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.fellowship_head&fellowship_id=eq.${payload.fellowship_id}&is_active=eq.true&select=id`,
      { headers: hdrs() }
    );
    const felHeads = await felRes.json();
    if (Array.isArray(felHeads)) felHeads.forEach((u: Record<string, string>) => ids.add(u.id));
  }

  // Care team for absence-related events
  if (['care_lead_created', 'first_timer_logged'].includes(payload.event)) {
    const careRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.care_team&is_active=eq.true&select=id`,
      { headers: hdrs() }
    );
    const care = await careRes.json();
    if (Array.isArray(care)) care.forEach((u: Record<string, string>) => ids.add(u.id));
  }

  // Accounts for financial events
  if (['income_logged', 'giving_submitted', 'partnership_giving_logged'].includes(payload.event)) {
    const accRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.accounts&is_active=eq.true&select=id`,
      { headers: hdrs() }
    );
    const acc = await accRes.json();
    if (Array.isArray(acc)) acc.forEach((u: Record<string, string>) => ids.add(u.id));
  }

  // Partnership for partnership events
  if (payload.event === 'partnership_giving_logged') {
    const partRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.partnership&is_active=eq.true&select=id`,
      { headers: hdrs() }
    );
    const part = await partRes.json();
    if (Array.isArray(part)) part.forEach((u: Record<string, string>) => ids.add(u.id));
  }

  return Array.from(ids);
}

function buildNotification(payload: DispatchPayload): { title: string; body: string; type: string } {
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
        title: `Income recorded${payload.amount ? ` — ₦${payload.amount.toLocaleString()}` : ''}`,
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
        title: `Partnership giving logged${payload.amount ? ` — ₦${payload.amount.toLocaleString()}` : ''}`,
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

export async function POST(req: Request) {
  try {
    const payload: DispatchPayload = await req.json();

    // Validate it's an internal call
    const internalSecret = req.headers.get('x-internal-secret');
    if (!process.env.INTERNAL_SECRET || internalSecret !== process.env.INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipients = await getRecipients(payload);
    if (recipients.length === 0) {
      return NextResponse.json({ data: { sent: 0 }, error: null });
    }

    const notif = buildNotification(payload);
    const rows = recipients.map(userId => ({
      user_id: userId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      read: false,
    }));

    await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(rows),
    });

    return NextResponse.json({ data: { sent: rows.length }, error: null });
  } catch (err) {
    console.error('[POST /api/notify/dispatch]', err);
    return NextResponse.json({ data: null, error: { message: 'Dispatch failed' } }, { status: 500 });
  }
}
