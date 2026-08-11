import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { planById } from '@/lib/plans';
import { computeChurchFootprints } from '@/lib/platform-footprint';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

type UsageEventRow = { church_id: string; type: 'moshe' | 'sms' | 'whatsapp' | 'storage'; cost_ngn: string | number; billable_overage: boolean; created_at: string };
type BillingTxRow = { church_id: string; fee_ngn: string | number | null; status: string; created_at: string };
type LineItemRow = { id: string; name: string; monthly_bill_ngn: string | number | null };

// Every church's live spend rate — not just outliers. The command center's
// whole point is visibility across all of them: this week vs last week,
// a naive run-rate projection to month-end, and how much of that spend is
// already past the plan's included quota (billable_overage, tagged by
// src/lib/usage.ts at write time).
//
// Cost precision matters here — the response keeps EXACT and ESTIMATED
// cost strictly separate, never summed into one falsely-precise total:
//   exact:     real Claude token cost (usage_events.type='moshe', now
//              measured per-call — see src/app/api/ai/query/route.ts)
//              + real Paystack processing fees (billing_transactions.fee_ngn,
//              Paystack's own metered figure).
//   estimated: sms/whatsapp placeholders (no real per-unit cost source
//              yet) + this church's allocated share of every admin-entered
//              platform_cost_line_items bill (Supabase, Vercel, ...),
//              itself derived from an EXACT footprint (row/message/byte
//              counts — see src/lib/platform-footprint.ts) but always an
//              ESTIMATE once it becomes a ₦ figure, since Supabase bills
//              one shared project with no per-tenant itemization.
// Revenue is the church's plan price_ngn from plans.ts (null = Enterprise
// custom pricing — surfaced as "custom", never silently zeroed).
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const now = new Date();
    const since = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000).toISOString();
    const startOfMonthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [churchesRes, configRes, eventsRes, billingRes, lineItemsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/churches?select=id,name`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/church_config?select=church_id,church_name,plan_tier,subscription_status`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/usage_events?created_at=gte.${since}&select=church_id,type,cost_ngn,billable_overage,created_at`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/billing_transactions?created_at=gte.${startOfMonthIso}&status=eq.success&select=church_id,fee_ngn,status,created_at`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/platform_cost_line_items?select=id,name,monthly_bill_ngn`, { headers: hdrs() }),
    ]);

    const churches: { id: string; name: string }[] = await churchesRes.json().catch(() => []);
    const configs: { church_id: string; church_name: string; plan_tier: string; subscription_status: string }[] = await configRes.json().catch(() => []);
    const events: UsageEventRow[] = await eventsRes.json().catch(() => []);
    const billingTx: BillingTxRow[] = await billingRes.json().catch(() => []);
    const lineItems: LineItemRow[] = await lineItemsRes.json().catch(() => []);

    const configByChurch: Record<string, { church_name: string; plan_tier: string; subscription_status: string }> = {};
    (Array.isArray(configs) ? configs : []).forEach(c => { if (c.church_id) configByChurch[c.church_id] = c; });

    const nameById: Record<string, string> = {};
    (Array.isArray(churches) ? churches : []).forEach(c => { nameById[c.id] = configByChurch[c.id]?.church_name || c.name; });

    const churchIds = Object.keys(configByChurch);

    // Real Paystack processing fees this month, per church — exact, not
    // estimated (Paystack's own data.fees figure, captured on charge.success).
    const paystackFeeThisMonth: Record<string, number> = {};
    for (const tx of Array.isArray(billingTx) ? billingTx : []) {
      if (!tx.church_id || tx.fee_ngn === null || tx.fee_ngn === undefined) continue;
      paystackFeeThisMonth[tx.church_id] = (paystackFeeThisMonth[tx.church_id] || 0) + (Number(tx.fee_ngn) || 0);
    }

    // Allocated (estimated) share of every admin-entered platform bill —
    // computed from the same exact footprint every line item reuses.
    const footprints = await computeChurchFootprints(churchIds);
    const footprintByChurch: Record<string, typeof footprints[number]> = {};
    footprints.forEach(f => { footprintByChurch[f.church_id] = f; });

    const dayMs = 24 * 60 * 60 * 1000;
    const startOfThisWeek = now.getTime() - 7 * dayMs;
    const startOfLastWeek = now.getTime() - 14 * dayMs;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const daysElapsedInMonth = Math.max(1, (now.getTime() - startOfMonth) / dayMs);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    type ChurchUsage = {
      church_id: string; church_name: string; plan_tier: string; subscription_status: string;
      this_week_ngn: number; last_week_ngn: number; this_month_ngn: number;
      this_month_by_type: Record<string, number>; overage_events_this_month: number;
      projected_month_end_ngn: number;
    };
    const byChurch: Record<string, ChurchUsage> = {};

    function bucket(churchId: string): ChurchUsage {
      if (!byChurch[churchId]) {
        const cfg = configByChurch[churchId];
        byChurch[churchId] = {
          church_id: churchId,
          church_name: nameById[churchId] || cfg?.church_name || 'Unknown church',
          plan_tier: cfg?.plan_tier || 'trial',
          subscription_status: cfg?.subscription_status || 'trial',
          this_week_ngn: 0, last_week_ngn: 0, this_month_ngn: 0,
          this_month_by_type: { moshe: 0, sms: 0, whatsapp: 0, storage: 0 },
          overage_events_this_month: 0,
          projected_month_end_ngn: 0,
        };
      }
      return byChurch[churchId];
    }

    for (const e of (Array.isArray(events) ? events : [])) {
      if (!e.church_id) continue;
      const b = bucket(e.church_id);
      const t = new Date(e.created_at).getTime();
      const cost = Number(e.cost_ngn) || 0;
      if (t >= startOfThisWeek) b.this_week_ngn += cost;
      else if (t >= startOfLastWeek) b.last_week_ngn += cost;
      if (t >= startOfMonth) {
        b.this_month_ngn += cost;
        b.this_month_by_type[e.type] = (b.this_month_by_type[e.type] || 0) + cost;
        if (e.billable_overage) b.overage_events_this_month += 1;
      }
    }

    // Every church with a plan should show up even at zero spend — a $0
    // row is still information ("this Growth church isn't using what
    // they're paying for"), not something to hide.
    for (const churchId of churchIds) bucket(churchId);

    const result = Object.values(byChurch).map(b => {
      const plan = planById(b.plan_tier);
      const footprint = footprintByChurch[b.church_id];
      const moshe = b.this_month_by_type.moshe || 0; // exact — real Claude token cost
      const paystackFee = paystackFeeThisMonth[b.church_id] || 0; // exact — real Paystack fee

      const platformAllocations = (Array.isArray(lineItems) ? lineItems : []).map(li => {
        const bill = li.monthly_bill_ngn === null || li.monthly_bill_ngn === undefined ? null : Number(li.monthly_bill_ngn);
        const share = footprint?.share ?? 0;
        return {
          id: li.id,
          name: li.name,
          footprint_share: share, // exact ratio derived from exact counts
          // Allocated ₦ is ALWAYS an estimate — null if the bill hasn't
          // been entered, never a silently-defaulted ₦0.
          allocated_ngn: bill === null ? null : Math.round(share * bill * 100) / 100,
        };
      });
      const platformAllocatedTotal = platformAllocations.reduce((s, a) => s + (a.allocated_ngn ?? 0), 0);
      const smsWhatsapp = (b.this_month_by_type.sms || 0) + (b.this_month_by_type.whatsapp || 0);

      const exact_ngn = Math.round((moshe + paystackFee) * 100) / 100;
      const estimated_ngn = Math.round((smsWhatsapp + platformAllocatedTotal) * 100) / 100;

      const revenue_ngn = plan?.price_ngn ?? null; // null = Enterprise custom pricing

      return {
        ...b,
        projected_month_end_ngn: Math.round((b.this_month_ngn / daysElapsedInMonth) * daysInMonth),
        cost_breakdown: {
          exact_ngn,             // real, metered — Claude tokens + Paystack fees
          estimated_ngn,         // SMS/WhatsApp placeholders + allocated platform-bill share
          claude_ngn: Math.round(moshe * 100) / 100,
          paystack_fee_ngn: Math.round(paystackFee * 100) / 100,
          sms_whatsapp_ngn: Math.round(smsWhatsapp * 100) / 100,
          platform_allocations: platformAllocations,
        },
        footprint: footprint ? {
          members: footprint.members,
          attendance_records: footprint.attendance_records,
          chat_messages_total: footprint.chat_messages_total,
          chat_messages_this_month: footprint.chat_messages_this_month,
          feed_posts: footprint.feed_posts,
          feed_comments: footprint.feed_comments,
          feed_reactions: footprint.feed_reactions,
          storage_bytes: footprint.storage_bytes,
          share: footprint.share,
        } : null,
        revenue_ngn,   // null = "custom" (Enterprise) — never treat as ₦0
        // margin is only meaningful against a known list price; Enterprise
        // is sales-negotiated, so margin stays null rather than a bogus
        // negative number computed against a ₦0 that was never real.
        margin_ngn: revenue_ngn === null ? null : Math.round((revenue_ngn - exact_ngn - estimated_ngn) * 100) / 100,
      };
    }).sort((a, b) => b.this_month_ngn - a.this_month_ngn);

    return NextResponse.json({ data: { churches: result }, error: null });
  } catch (err) {
    console.error('[GET /api/admin/usage]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load usage' } }, { status: 500 });
  }
}
