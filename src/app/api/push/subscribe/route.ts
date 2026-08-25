import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// Called once the browser grants Notification permission and the client
// has subscribed via pushManager.subscribe(...) — see NotificationBell's
// requestNotifPermission. `endpoint` is UNIQUE (see the migration): an
// upsert here means re-subscribing the same device (a refreshed key, a
// second account signing in from the same browser) just replaces the
// row instead of piling up duplicates that would all get pushed to.
export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json().catch(() => null);
    const endpoint: string | undefined = body?.endpoint;
    const p256dh: string | undefined = body?.keys?.p256dh;
    const auth: string | undefined = body?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ data: null, error: { message: 'Malformed subscription' } }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
      method: 'POST',
      headers: { ...hdrs(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ user_id: user.id, endpoint, p256dh, auth }]),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[push/subscribe] upsert failed:', res.status, errText);
      return NextResponse.json({ data: null, error: { message: 'Failed to save subscription' } }, { status: 500 });
    }
    return NextResponse.json({ data: { ok: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Failed to save subscription' } }, { status: 500 });
  }
}
