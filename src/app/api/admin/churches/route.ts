import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/church_config?select=id,church_name,country,structure_type,tier1_label,tier2_label,plan_tier,subscription_status,trial_started_at,trial_ends_at,subscription_started_at,is_configured,church_profile,created_at&order=created_at.desc`,
      { headers: hdrs() }
    );
    const data = await res.json();

    const now = new Date();
    const churches = (Array.isArray(data) ? data : []).map((c: Record<string, unknown>) => {
      const trialEnd = c.trial_ends_at ? new Date(c.trial_ends_at as string) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        ...c,
        trial_days_remaining: daysRemaining,
        church_profile: typeof c.church_profile === 'string' ? JSON.parse(c.church_profile) : (c.church_profile || {}),
      };
    });

    return NextResponse.json({ data: { churches }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load' } }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const body = await req.json();
    const { id, admin_notes, action } = body;
    if (!id) return NextResponse.json({ data: null, error: { message: 'id is required' } }, { status: 400 });

    // Enterprise is sales-negotiated — there's no fixed price to verify a
    // Paystack transaction against (see /api/subscription's own refusal
    // of this plan), so this narrow, explicit, lead_tech-only action is
    // the one legitimate path to turn it on or off. Deliberately NOT a
    // generic "set any plan_tier/subscription_status" field-setter —
    // that exact shape (any authenticated caller sending a field the
    // client controls) is what the church-config route's own bypass bug
    // looked like; keeping this to two fixed, named actions closes off
    // the same class of hole here.
    if (action === 'activate_enterprise' || action === 'deactivate_enterprise') {
      const isActivating = action === 'activate_enterprise';
      await fetch(`${SUPABASE_URL}/rest/v1/church_config?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...hdrs(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(isActivating
          ? { plan_tier: 'enterprise', subscription_status: 'active', subscription_started_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : { subscription_status: 'expired', updated_at: new Date().toISOString() }),
      });
      logAudit({
        actor_id: user.id, actor_role: user.role,
        action: isActivating ? 'enterprise_activated' : 'enterprise_deactivated',
        target_type: 'church_config', target_id: id,
      });
      return NextResponse.json({ data: { updated: true }, error: null });
    }

    // Get current church_profile and merge notes
    const existing = await fetch(`${SUPABASE_URL}/rest/v1/church_config?id=eq.${id}&select=church_profile&limit=1`, { headers: hdrs() });
    const existingData = await existing.json();
    const currentProfile = existingData?.[0]?.church_profile || {};
    const updatedProfile = { ...(typeof currentProfile === 'string' ? JSON.parse(currentProfile) : currentProfile), admin_notes };

    await fetch(`${SUPABASE_URL}/rest/v1/church_config?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ church_profile: updatedProfile, updated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update' } }, { status: 500 });
  }
}
