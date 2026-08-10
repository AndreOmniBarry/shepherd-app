// ============================================================
// SHEP.HERD — Plan definitions (single source of truth)
// Consumed by: /setup (plan picker), the public landing page's
// pricing section, and src/lib/plan-gate.ts (the server-side
// entitlement check). Keep `limits` here in sync with whatever
// plan-gate.ts actually enforces — this file is the copy AND
// the contract.
// ============================================================

export type PlanId = 'starter' | 'growth' | 'enterprise';

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  // Numeric ₦/month for server-side verification (Paystack amount check in
  // /api/subscription) — null for Enterprise, which is sales-negotiated and
  // never goes through the self-service upgrade flow.
  price_ngn: number | null;
  period: string;
  badge: string;
  accent: 'teal' | 'purple' | 'amber';
  description: string;
  features: string[];
  limits: string[];
  // Monthly quota before pay-as-you-go overage kicks in. null = unlimited.
  // Real usage is closer to <100 Moshe queries/mo on average — these caps
  // are meant to sit just above that so an average church never notices
  // them, while a church actually leaning on the product hits the wall
  // and becomes an upgrade (or overage revenue) conversation, not a
  // support ticket. Overage rates are provisional until real Claude API /
  // Termii per-unit costs are measured — see docs/pricing-notes.
  moshe_monthly_quota: number | null;
  sms_monthly_quota: number | null;
  moshe_overage_ngn: number; // per query, once over quota
  sms_overage_ngn: number; // per message, once over quota
  // Chat costs nothing extra per use, so it's never plan-gated — but on
  // Starter it's restricted to admin-tier roles (see role-gate in
  // src/app/api/chat/*) so a church has a real reason to upgrade the
  // whole team onto it, without taking away a feature that has no
  // marginal cost to begin with.
  chat_admin_only: boolean;
  // Hard resource caps for this tier, enforced by src/lib/plan-gate.ts's
  // requireWithinPlanLimit() at creation time. null = unlimited. These are
  // the machine-enforced version of the "Up to N members / X location(s) /
  // Up to N cells/groups" copy in `features` above — keep both in sync.
  // Enforcement is "grandfather existing, block new": a church already over
  // a cap keeps everything it has, it just can't create more of that
  // resource while at/over the cap. Departments are NOT covered by
  // `cells` — the copy only ever promises a cap on cells/groups, so
  // departments stay uncapped on every tier.
  resource_limits: {
    members: number | null;
    cells: number | null;
    branches: number | null;
  };
};

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₦15,000',
    price_ngn: 15000,
    period: '/month',
    badge: '',
    accent: 'teal',
    description: 'For small churches getting organised',
    features: [
      'Up to 500 members',
      '1 location',
      'Up to 20 cells/groups',
      'Attendance tracking',
      'Member management',
      'Basic giving records',
      'Church feed & shared calendar',
      'Care & follow-up pipeline',
      'Workforce rosters & serving schedules',
      'Recognition & commendations',
      'Chat (admins & leaders only)',
      'Email support',
    ],
    limits: ['No AI (Moshe)', 'No partnership portal', 'No SMS/WhatsApp alerts', 'Chat limited to admin roles'],
    moshe_monthly_quota: 0,
    sms_monthly_quota: 0,
    moshe_overage_ngn: 0,
    sms_overage_ngn: 0,
    chat_admin_only: true,
    resource_limits: { members: 500, cells: 20, branches: 1 },
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₦35,000',
    price_ngn: 35000,
    period: '/month',
    badge: 'Most popular',
    accent: 'purple',
    description: 'For growing churches that need full intelligence',
    features: [
      'Up to 5,000 members',
      'Up to 10 locations',
      'Unlimited cells/groups',
      'Moshe AI agent — 120 queries/mo included',
      'Partnership portal',
      'SMS & WhatsApp alerts — 300/mo included',
      'Chat for everyone, no role limit',
      'Full analytics & reports',
      'Priority support',
    ],
    limits: ['Additional Moshe queries and SMS beyond the included quota billed pay-as-you-go'],
    moshe_monthly_quota: 120,
    sms_monthly_quota: 300,
    moshe_overage_ngn: 50,
    sms_overage_ngn: 15,
    chat_admin_only: false,
    resource_limits: { members: 5000, cells: null, branches: 10 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    price_ngn: null,
    period: '',
    badge: '',
    accent: 'amber',
    description: 'For denominations and large multi-site churches',
    features: [
      'Unlimited members & locations',
      'Multi-currency support',
      'White-label branding (setup fee + recurring add-on)',
      'Custom integrations',
      'API access',
      'High-volume Moshe & SMS/WhatsApp quotas, sized to your church',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    limits: [],
    // Sales-negotiated per church — priced as a floor covering up to 25
    // branches, plus a per-branch/per-1,000-member overage past that (see
    // public/billing-calculator.html). Quotas here are a high default
    // floor, not the final number.
    moshe_monthly_quota: 1000,
    sms_monthly_quota: 2000,
    moshe_overage_ngn: 40,
    sms_overage_ngn: 12,
    chat_admin_only: false,
    resource_limits: { members: null, cells: null, branches: null },
  },
];

export function planById(id: string | null | undefined): Plan | undefined {
  return PLANS.find(p => p.id === id);
}

// Trial is a subscription_status, not a plan tier of its own (whichever
// plan a church picks at signup, it's still "trial" until they pay) — so
// it has no entry in PLANS, but it gets one carved-out allowance: enough
// real SMS sends for a church to see the feature actually work during
// their 30 days, without giving away unmetered infra to an account that
// has no payment method on file yet. Hard-capped, not pay-as-you-go
// overage — there's nothing to bill overage against during a trial.
export const TRIAL_SMS_MONTHLY_CAP = 50;

// The three premium features every plan card calls out are bundled behind
// one gate, not three: an ACTIVE Growth or Enterprise subscription. A trial
// (any plan chosen) and a paid Starter subscription both land in the same
// core-only bucket — trial isn't "full access to whatever you'll eventually
// buy", it's a real taste of the product with the premium ceiling visible
// but locked, same as Starter.
export function hasPremiumAccess(config: {
  plan_tier?: string | null;
  subscription_status?: string | null;
}): boolean {
  return (
    config.subscription_status === 'active' &&
    (config.plan_tier === 'growth' || config.plan_tier === 'enterprise')
  );
}
