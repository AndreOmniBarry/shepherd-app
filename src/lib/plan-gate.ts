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
import { hasPremiumAccess, planById } from '@/lib/plans';

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

// Fire-and-forget, same non-blocking pattern as src/lib/usage.ts's
// recordUsage — every blocked attempt at a premium/chat/resource-limit-gated
// action gets one row here. src/lib/health-checks.ts watches this table for
// a church racking up an unusual volume of blocked attempts (a real signal
// of someone probing for a payment/subscription bypass) and raises it as a
// system_alert on the existing Health & Alerts admin tab.
function logAccessViolation(churchId: string | null | undefined, userId: string | null | undefined, gate: 'premium' | 'chat' | 'resource_limit') {
  if (!churchId && !userId) return;
  fetch(`${SUPABASE_URL}/rest/v1/access_violations`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ church_id: churchId || null, user_id: userId || null, gate }),
  }).catch(() => {});
}

// Returns a 403 NextResponse to return immediately if the church isn't
// entitled, or null if the caller should proceed.
export async function requirePremium(churchId: string | null | undefined, userId?: string | null): Promise<NextResponse | null> {
  const config = await getChurchPlan(churchId);
  if (hasPremiumAccess(config)) return null;
  logAccessViolation(churchId, userId, 'premium');
  return NextResponse.json(
    { data: null, error: { message: UPGRADE_MESSAGE, code: 'UPGRADE_REQUIRED' } },
    { status: 403 }
  );
}

// Chat has no marginal cost, so unlike requirePremium it's never an on/off
// plan gate — every plan gets it. On Starter, though, it's restricted to
// admin-tier roles, so a church has a real reason to move its whole team
// onto Growth without losing a feature that costs nothing to give away.
const CHAT_ADMIN_ROLES = ['overseer', 'general_overseer', 'pa', 'lead_tech', 'branch_pastor'];
const CHAT_RESTRICTED_MESSAGE = 'Chat is available to admins and pastors on the Starter plan — upgrade to Growth to open it up to your whole team.';

export async function requireChatAccess(churchId: string | null | undefined, role: string | null | undefined, userId?: string | null): Promise<NextResponse | null> {
  const config = await getChurchPlan(churchId);
  const plan = planById(config.plan_tier);
  const adminOnly = plan?.chat_admin_only ?? true; // fail closed (trial/unknown tier) same as Starter
  if (!adminOnly || CHAT_ADMIN_ROLES.includes(role || '')) return null;
  logAccessViolation(churchId, userId, 'chat');
  return NextResponse.json(
    { data: null, error: { message: CHAT_RESTRICTED_MESSAGE, code: 'UPGRADE_REQUIRED' } },
    { status: 403 }
  );
}

// ------------------------------------------------------------------
// Resource-count gate (members / cells / branches)
// ------------------------------------------------------------------
// A separate, additive gate from the premium/chat feature gates above —
// this one enforces the hard per-tier resource caps plans.ts advertises
// ("Up to 500 members", "1 location", "Up to 20 cells/groups"), not
// feature access. Policy: grandfather existing, block new. A church
// already sitting at or over its plan's cap keeps every resource it
// currently has — nothing is touched retroactively — it just can't
// create MORE of that resource until it upgrades (or drops below the cap
// some other way). Each resource type is checked independently: being
// over on cells doesn't block creating a member that's still under cap.
export type ResourceType = 'members' | 'cells' | 'branches';

const RESOURCE_TABLE: Record<ResourceType, string> = {
  members: 'members',
  cells: 'cells',
  branches: 'branches',
};

// Matches the wording plans.ts uses in its `features` copy, so the error
// message reads consistently with the pricing page.
const RESOURCE_LABEL: Record<ResourceType, string> = {
  members: 'members',
  cells: 'cells/groups',
  branches: 'locations',
};

// Exact count of a church's current resources of one type via PostgREST's
// exact count (Content-Range header) — a HEAD request so no rows are
// actually transferred, just the total.
async function countChurchResource(churchId: string, resourceType: ResourceType): Promise<number> {
  const table = RESOURCE_TABLE[resourceType];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?church_id=eq.${churchId}&select=id`,
      { method: 'HEAD', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact' } }
    );
    const range = res.headers.get('content-range'); // "0-9/23"
    const total = range?.split('/')[1];
    return total && total !== '*' ? parseInt(total, 10) : 0;
  } catch {
    // Fail closed on a count we can't verify — treat as "at the limit"
    // rather than silently letting an unbounded number through.
    return Number.POSITIVE_INFINITY;
  }
}

const UPGRADE_LINK = 'Upgrade from Settings → Billing to add more.';

// Returns a 403 NextResponse to return immediately if creating one more
// (or `quantity` more, for bulk-create endpoints like POST /api/branches)
// resource of this type would push the church over its plan's cap, or
// null if the caller should proceed. Only ever blocks the NEW creation —
// never inspects or touches resources the church already has.
export async function requireWithinPlanLimit(
  churchId: string | null | undefined,
  resourceType: ResourceType,
  userId?: string | null,
  quantity: number = 1
): Promise<NextResponse | null> {
  // No church to scope the count against — nothing for this gate to check;
  // the route's own validation is responsible for rejecting a missing
  // church_id on the write itself.
  if (!churchId) return null;

  const config = await getChurchPlan(churchId);
  const plan = planById(config.plan_tier);
  // Unknown/trial tier fails closed to Starter's caps, same rationale as
  // requireChatAccess's adminOnly fallback.
  const cap = (plan ?? planById('starter'))!.resource_limits[resourceType];
  if (cap === null) return null; // unlimited on this tier

  const current = await countChurchResource(churchId, resourceType);
  if (current + quantity <= cap) return null;

  logAccessViolation(churchId, userId, 'resource_limit');
  const label = RESOURCE_LABEL[resourceType];
  return NextResponse.json(
    {
      data: null,
      error: {
        message: `You've reached the ${cap} ${label} included on your ${plan?.name ?? 'current'} plan. ${UPGRADE_LINK}`,
        code: 'UPGRADE_REQUIRED',
      },
    },
    { status: 403 }
  );
}
