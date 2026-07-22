import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

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

    const res = await fetch(`${SUPABASE_URL}/rest/v1/church_config?limit=1&select=plan_tier,subscription_status,trial_started_at,trial_ends_at,subscription_started_at`, { headers: hdrs() });
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
    if (!['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });
    }

    const body = await req.json();
    const { plan_tier, paystack_reference } = body;

    if (!['starter', 'growth', 'enterprise'].includes(plan_tier)) {
      return NextResponse.json({ data: null, error: { message: 'Invalid plan' } }, { status: 400 });
    }

    // TODO: Verify paystack_reference with the Paystack API before upgrading.
    // Until that verification is wired up, block self-service upgrades entirely —
    // trusting a client-supplied reference would let anyone upgrade for free.
    if (!paystack_reference) {
      return NextResponse.json({ data: null, error: { message: 'Paystack reference required.' } }, { status: 400 });
    }
    return NextResponse.json(
      { data: null, error: { message: 'Paystack verification required — contact support.' } },
      { status: 403 }
    );
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to upgrade' } }, { status: 500 });
  }
}
