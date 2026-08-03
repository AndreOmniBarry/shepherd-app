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
  period: string;
  badge: string;
  accent: 'teal' | 'purple' | 'amber';
  description: string;
  features: string[];
  limits: string[];
};

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₦15,000',
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
      'Email support',
    ],
    limits: ['No AI (Moshe)', 'No partnership portal', 'No SMS alerts'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₦35,000',
    period: '/month',
    badge: 'Most popular',
    accent: 'purple',
    description: 'For growing churches that need full intelligence',
    features: [
      'Up to 5,000 members',
      'Up to 10 locations',
      'Unlimited cells/groups',
      'Moshe AI agent',
      'Partnership portal',
      'SMS & WhatsApp alerts',
      'Full analytics & reports',
      'Priority support',
    ],
    limits: [],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    badge: '',
    accent: 'amber',
    description: 'For denominations and large multi-site churches',
    features: [
      'Unlimited members & locations',
      'Multi-currency support',
      'White-label branding',
      'Custom integrations',
      'API access',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    limits: [],
  },
];

export function planById(id: string | null | undefined): Plan | undefined {
  return PLANS.find(p => p.id === id);
}

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
