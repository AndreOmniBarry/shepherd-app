// ============================================================
// SHEP.HERD — Server-side premium-feature gate
// Single chokepoint for "is this church entitled to Moshe AI /
// the partnership portal / SMS & WhatsApp alerts". Route handlers
// should call requirePremium(user.church_id) right after their
// existing role check; sendSMS() in src/lib/sms.ts calls
// hasPremiumAccess() directly since it has no Request to build a
// NextResponse from.
// ============================================================
import { NextResponse } from 'next/server';
import { hasPremiumAccess } from '@/lib/plans';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// churchId is required, not optional — this used to grab whichever
// church_config row was created first, which was correct for a single
// church and silently wrong the moment a second one exists. A null/
// missing churchId fails closed to "trial" rather than guessing.
export async function getChurchPlan(churchId: string | null | undefined): Promise<{ plan_tier: string; subscription_status: string }> {
  if (!churchId) return { plan_tier: 'trial', subscription_status: 'trial' };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/church_config?church_id=eq.${churchId}&limit=1&select=plan_tier,subscription_status`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const data = await res.json();
    const config = data?.[0];
    return {
      plan_tier: config?.plan_tier || 'trial',
      subscription_status: config?.subscription_status || 'trial',
    };
  } catch {
    // Fail closed on the premium gate — an unreachable church_config means
    // "trial", never a silent unlock.
    return { plan_tier: 'trial', subscription_status: 'trial' };
  }
}

const UPGRADE_MESSAGE = 'This feature unlocks on an active Growth or Enterprise plan. Upgrade from Settings → Billing to turn it on.';

// Returns a 403 NextResponse to return immediately if the church isn't
// entitled, or null if the caller should proceed.
export async function requirePremium(churchId: string | null | undefined): Promise<NextResponse | null> {
  const config = await getChurchPlan(churchId);
  if (hasPremiumAccess(config)) return null;
  return NextResponse.json(
    { data: null, error: { message: UPGRADE_MESSAGE, code: 'UPGRADE_REQUIRED' } },
    { status: 403 }
  );
}
