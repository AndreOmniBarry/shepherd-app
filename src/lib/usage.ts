// ============================================================
// SHEP.HERD — Usage event logging (Moshe AI / SMS / WhatsApp)
// Backs the tech-admin command center's per-church spend monitor and
// the pay-as-you-go overage flag on plans.ts's monthly quotas. See
// scripts/48_usage_events.sql for the table this writes to.
// ============================================================
import { planById } from '@/lib/plans';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export type UsageType = 'moshe' | 'sms' | 'whatsapp';

// Provisional per-unit cost estimates in ₦ — this is OUR infra/provider
// cost for margin visibility on the command center, not what a church is
// charged. Tune once real Claude API / Termii per-unit costs are measured
// against actual traffic; these are placeholders, not a bill.
const COST_NGN: Record<UsageType, number> = { moshe: 45, sms: 12, whatsapp: 12 };

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// Count of this church's events of `type` since the start of the current
// calendar month — the window every quota check and the command center's
// "this month" figures are measured against.
export async function getMonthlyUsageCount(churchId: string, type: UsageType): Promise<number> {
  if (!churchId) return 0;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/usage_events?church_id=eq.${churchId}&type=eq.${type}&created_at=gte.${startOfMonthIso()}&select=id`,
      { headers: { ...hdrs(), Range: '0-0', Prefer: 'count=exact' } }
    );
    const range = res.headers.get('content-range'); // shape: "0-0/23"
    const total = range?.split('/')[1];
    return total ? parseInt(total, 10) : 0;
  } catch {
    return 0;
  }
}

// Logs one usage event and tags it as billable overage if the church was
// already at or past its plan's included monthly quota for `type`. Never
// blocks the caller — the on/off premium gate (plan-gate.ts) is what
// decides access at all; this only decides whether the unit is "included"
// or "pay-as-you-go" for later invoicing/upsell, surfaced on the command
// center rather than auto-charged (no live billing customers yet).
export async function recordUsage(
  churchId: string | null | undefined,
  type: UsageType,
  planTier: string | null | undefined,
  metadata?: Record<string, unknown>
): Promise<{ billable_overage: boolean; monthly_count: number; quota: number | null }> {
  if (!churchId) return { billable_overage: false, monthly_count: 0, quota: null };

  const plan = planById(planTier || undefined);
  const quota = type === 'sms' || type === 'whatsapp' ? plan?.sms_monthly_quota ?? null : plan?.moshe_monthly_quota ?? null;
  const countBefore = await getMonthlyUsageCount(churchId, type);
  const billable_overage = quota !== null && countBefore >= quota;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/usage_events`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({ church_id: churchId, type, cost_ngn: COST_NGN[type], billable_overage, metadata: metadata || null }),
    });
  } catch (err) {
    console.error('[recordUsage] failed to log usage event', err);
  }

  return { billable_overage, monthly_count: countBefore + 1, quota };
}
