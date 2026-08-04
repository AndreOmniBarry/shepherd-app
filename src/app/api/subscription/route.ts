import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { verifyPaystackTransaction, isPaystackConfigured } from '@/lib/paystack';
import { planById } from '@/lib/plans';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${user.church_id}&limit=1&select=plan_tier,subscription_status,trial_started_at,trial_ends_at,subscription_started_at`, { headers: hdrs() });
    const data = await res.json();
    const config = data?.[0];

    if (!config) return NextResponse.json({ data: { plan_tier: 'trial', status: 'trial', days_remaining: 30, is_active: true }, error: null });

    const now = new Date();
    const trialEnd = config.trial_ends_at ? new Date(config.trial_ends_at) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const isActive = config.subscription_status === 'active' || (config.subscription_status === 'trial' && daysRemaining > 0);

    return NextResponse.json({
      data: {
        plan_tier: config.plan_tier || 'trial',
        status: config.subscription_status || 'trial',
        days_remaining: daysRemaining,
        trial_ends_at: config.trial_ends_at,
        subscription_started_at: config.subscription_started_at,
        is_active: isActive,
      },
      error: null,
    });
  } catch (err) {
    return NextResponse.json({ data: { plan_tier: 'trial', status: 'trial', days_remaining: 30, is_active: true }, error: null });
  }
}

// Upgrade plan after Paystack payment confirmed
export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    // Church-wide billing — the top authority only (overseer covers the
    // single-congregation case where general_overseer doesn't exist yet),
    // never a branch_pastor or pa scoped to one branch.
    if (!['overseer', 'general_overseer', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
    }

    const body = await req.json();
    const { plan_tier, paystack_reference } = body;

    if (!['starter', 'growth'].includes(plan_tier)) {
      // Enterprise is sales-negotiated (custom pricing, no fixed amount to
      // verify against) — it's activated manually by lead_tech from the
      // admin panel, never through this self-service card-payment flow.
      return NextResponse.json({ data: null, error: { message: 'This plan is set up manually — contact support to switch to it.' } }, { status: 400 });
    }
    if (!paystack_reference) {
      return NextResponse.json({ data: null, error: { message: 'Paystack reference required.' } }, { status: 400 });
    }
    if (!isPaystackConfigured()) {
      return NextResponse.json({ data: null, error: { message: 'Payments are not enabled on this deployment yet — contact support.' } }, { status: 503 });
    }
    if (!user.church_id) {
      return NextResponse.json({ data: null, error: { message: 'No church on this account to upgrade.' } }, { status: 400 });
    }

    // The one call that actually confirms money moved — never trust the
    // client-supplied reference on its own.
    const verified = await verifyPaystackTransaction(paystack_reference);
    if (!verified.ok) {
      return NextResponse.json({ data: null, error: { message: `Payment could not be verified: ${verified.reason}` } }, { status: 402 });
    }

    const plan = planById(plan_tier);
    if (plan?.price_ngn != null && verified.amount_ngn !== plan.price_ngn) {
      console.error(`[subscription upgrade] amount mismatch — reference=${paystack_reference} expected=${plan.price_ngn} got=${verified.amount_ngn}`);
      return NextResponse.json({ data: null, error: { message: 'Amount paid does not match the selected plan.' } }, { status: 402 });
    }

    // The UNIQUE constraint on paystack_reference is the actual replay
    // guard — a duplicate insert here means this reference already
    // upgraded a church once, so this request is a retry/replay, not a
    // second payment. Fail closed rather than upgrading twice for one charge.
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/billing_transactions`, {
      method: 'POST',
      headers: { ...hdrs(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        church_id: user.church_id, paystack_reference, plan_tier,
        amount_ngn: verified.amount_ngn, status: 'success', source: 'self_service',
      }),
    });
    if (!insertRes.ok) {
      const text = await insertRes.text().catch(() => '');
      if (text.includes('duplicate key')) {
        return NextResponse.json({ data: null, error: { message: 'This payment has already been applied.' } }, { status: 409 });
      }
      console.error('[subscription upgrade] failed to record transaction', insertRes.status, text);
      return NextResponse.json({ data: null, error: { message: 'Failed to record payment' } }, { status: 500 });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${user.church_id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), Prefer: 'return=minimal' },
      body: JSON.stringify({ plan_tier, subscription_status: 'active', subscription_started_at: new Date().toISOString() }),
    });

    return NextResponse.json({ data: { plan_tier, status: 'active' }, error: null });
  } catch (err) {
    console.error('[PATCH /api/subscription]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to upgrade' } }, { status: 500 });
  }
}
