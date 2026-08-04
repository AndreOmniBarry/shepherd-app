export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyPaystackSignature } from '@/lib/paystack';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// Recurring billing events (renewals, failed charges, cancellations) —
// separate from the self-service upgrade flow in /api/subscription, which
// only ever handles the FIRST charge a church makes. This route has no
// shepherd_token cookie to check (Paystack is calling it, not a logged-in
// user) — the HMAC signature check below is the only auth there is, so it
// is registered in src/middleware.ts's PUBLIC_PATHS and must never be
// removed from there without this signature check staying in place.
//
// Expects event.data.metadata.church_id to be set on whatever transaction/
// subscription was created — the not-yet-built customer-facing "subscribe"
// flow must pass that metadata when calling Paystack's initialize endpoint,
// or these events have no church to apply to.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ data: null, error: { message: 'Invalid signature' } }, { status: 401 });
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Invalid payload' } }, { status: 400 });
  }

  try {
    const data = event.data || {};
    const metadata = (data.metadata as Record<string, unknown>) || {};
    const churchId = metadata.church_id as string | undefined;

    if (churchId) {
      switch (event.event) {
        case 'charge.success': {
          const reference = data.reference as string | undefined;
          const amountNgn = (Number(data.amount) || 0) / 100;
          if (reference) {
            await fetch(`${SUPABASE_URL}/rest/v1/billing_transactions`, {
              method: 'POST', headers: { ...hdrs(), Prefer: 'return=minimal' },
              body: JSON.stringify({
                church_id: churchId, paystack_reference: reference,
                plan_tier: (metadata.plan_tier as string) || 'growth',
                amount_ngn: amountNgn, status: 'success', source: 'webhook', raw_event: event,
              }),
            }).catch(() => {}); // duplicate reference = already recorded, not an error
          }
          await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${churchId}`, {
            method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
            body: JSON.stringify({ subscription_status: 'active' }),
          }).catch(() => {});
          break;
        }
        case 'subscription.disable':
        case 'subscription.not_renew':
          await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${churchId}`, {
            method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
            body: JSON.stringify({ subscription_status: 'cancelled' }),
          }).catch(() => {});
          break;
        case 'invoice.payment_failed':
          await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${churchId}`, {
            method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
            body: JSON.stringify({ subscription_status: 'expired' }),
          }).catch(() => {});
          break;
      }
    }
  } catch (err) {
    // Swallow processing errors rather than making Paystack retry-storm a
    // webhook that already passed signature verification — log for manual
    // follow-up instead.
    console.error('[POST /api/webhooks/paystack]', err);
  }

  return NextResponse.json({ data: { received: true }, error: null });
}
