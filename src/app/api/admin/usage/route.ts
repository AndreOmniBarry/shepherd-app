import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

type UsageEventRow = { church_id: string; type: 'moshe' | 'sms' | 'whatsapp'; cost_ngn: string | number; billable_overage: boolean; created_at: string };

// Every church's live spend rate — not just outliers. The command center's
// whole point is visibility across all of them: this week vs last week,
// a naive run-rate projection to month-end, and how much of that spend is
// already past the plan's included quota (billable_overage, tagged by
// src/lib/usage.ts at write time).
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const now = new Date();
    const since = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000).toISOString();

    const [churchesRes, configRes, eventsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/churches?select=id,name`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/church_config?select=church_id,church_name,plan_tier,subscription_status`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/usage_events?created_at=gte.${since}&select=church_id,type,cost_ngn,billable_overage,created_at`, { headers: hdrs() }),
    ]);

    const churches: { id: string; name: string }[] = await churchesRes.json().catch(() => []);
    const configs: { church_id: string; church_name: string; plan_tier: string; subscription_status: string }[] = await configRes.json().catch(() => []);
    const events: UsageEventRow[] = await eventsRes.json().catch(() => []);

    const configByChurch: Record<string, { church_name: string; plan_tier: string; subscription_status: string }> = {};
    (Array.isArray(configs) ? configs : []).forEach(c => { if (c.church_id) configByChurch[c.church_id] = c; });

    const nameById: Record<string, string> = {};
    (Array.isArray(churches) ? churches : []).forEach(c => { nameById[c.id] = configByChurch[c.id]?.church_name || c.name; });

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
          this_month_by_type: { moshe: 0, sms: 0, whatsapp: 0 },
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
    for (const churchId of Object.keys(configByChurch)) bucket(churchId);

    const result = Object.values(byChurch).map(b => ({
      ...b,
      projected_month_end_ngn: Math.round((b.this_month_ngn / daysElapsedInMonth) * daysInMonth),
    })).sort((a, b) => b.this_month_ngn - a.this_month_ngn);

    return NextResponse.json({ data: { churches: result }, error: null });
  } catch (err) {
    console.error('[GET /api/admin/usage]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load usage' } }, { status: 500 });
  }
}
