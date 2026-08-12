import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}
// Last N month buckets ending this month, oldest first — so a church/user
// with zero signups in a given month still shows a 0 bar instead of the
// trend line silently skipping months with no data.
function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Platform-wide growth/adoption analytics — separate from the Usage &
// Spend tab, which is about ₦ cost/margin per church. This tab is about
// "is the product growing and who's actually using it": total churches,
// total registered users, signup trend, plan/status/structure/country
// mix, and a usage_events volume trend (not its cost, its VOLUME — how
// much Moshe/SMS/WhatsApp/storage activity is happening platform-wide,
// week over week).
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [churchesRes, usersRes, eventsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/church_config?select=church_id,church_name,country,structure_type,plan_tier,subscription_status,created_at`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/users?select=id,role,church_id,is_active,created_at${EXCLUDE_DEMO_IDS}`, { headers: hdrs() }),
      fetch(`${SUPABASE_URL}/rest/v1/usage_events?created_at=gte.${since90}&select=type,church_id,created_at`, { headers: hdrs() }),
    ]);

    type ChurchRow = { church_id: string; church_name: string; country: string | null; structure_type: string | null; plan_tier: string | null; subscription_status: string | null; created_at: string };
    type UserRow = { id: string; role: string; church_id: string | null; is_active: boolean; created_at: string };
    type EventRow = { type: string; church_id: string; created_at: string };

    const churches: ChurchRow[] = await churchesRes.json().catch(() => []);
    const users: UserRow[] = await usersRes.json().catch(() => []);
    const events: EventRow[] = await eventsRes.json().catch(() => []);

    const churchList = Array.isArray(churches) ? churches : [];
    const userList = Array.isArray(users) ? users : [];
    const eventList = Array.isArray(events) ? events : [];

    // ── Headline counts ──────────────────────────────────────
    const totalChurches = churchList.length;
    const totalUsers = userList.length;
    const activeUsers = userList.filter(u => u.is_active !== false).length;

    // ── Breakdowns ────────────────────────────────────────────
    function tally(items: (string | null | undefined)[]): Record<string, number> {
      const out: Record<string, number> = {};
      for (const raw of items) {
        const key = raw || 'unknown';
        out[key] = (out[key] || 0) + 1;
      }
      return out;
    }
    const byPlan = tally(churchList.map(c => c.plan_tier));
    const byStatus = tally(churchList.map(c => c.subscription_status));
    const byStructure = tally(churchList.map(c => c.structure_type));
    const byCountry = tally(churchList.map(c => c.country));
    const byRole = tally(userList.map(u => u.role));

    // ── Signup trends, last 6 months ─────────────────────────
    const months = lastNMonths(6);
    const churchesByMonth = tally(churchList.map(c => monthKey(c.created_at)).filter(Boolean));
    const usersByMonth = tally(userList.map(u => monthKey(u.created_at)).filter(Boolean));
    const churchSignupTrend = months.map(m => ({ month: m, count: churchesByMonth[m] || 0 }));
    const userSignupTrend = months.map(m => ({ month: m, count: usersByMonth[m] || 0 }));

    // ── Usage volume trend, last 30 days (event COUNT, not cost — see
    // /api/admin/usage for the ₦ view of the same underlying table) ──
    const days = lastNDays(30);
    const eventsLast30 = eventList.filter(e => e.created_at >= since30);
    const byDay: Record<string, number> = {};
    const byDayType: Record<string, Record<string, number>> = {};
    for (const e of eventsLast30) {
      const d = dayKey(e.created_at);
      byDay[d] = (byDay[d] || 0) + 1;
      byDayType[d] = byDayType[d] || {};
      byDayType[d][e.type] = (byDayType[d][e.type] || 0) + 1;
    }
    const usageTrend = days.map(d => ({ day: d, total: byDay[d] || 0, ...byDayType[d] }));
    const usageByType = tally(eventsLast30.map(e => e.type));

    // Which churches generated the most usage_events in the last 30 days —
    // an adoption/engagement signal distinct from the Usage & Spend tab's
    // cost ranking (a church can generate lots of activity while staying
    // well under quota, and that's exactly the kind of healthy-engagement
    // signal that tab doesn't surface).
    const eventsByChurch: Record<string, number> = {};
    for (const e of eventsLast30) { if (e.church_id) eventsByChurch[e.church_id] = (eventsByChurch[e.church_id] || 0) + 1; }
    const nameByChurchId: Record<string, string> = {};
    churchList.forEach(c => { nameByChurchId[c.church_id] = c.church_name; });
    const mostEngagedChurches = Object.entries(eventsByChurch)
      .map(([church_id, count]) => ({ church_id, church_name: nameByChurchId[church_id] || 'Unknown', event_count: count }))
      .sort((a, b) => b.event_count - a.event_count)
      .slice(0, 10);

    return NextResponse.json({
      data: {
        totalChurches, totalUsers, activeUsers,
        byPlan, byStatus, byStructure, byCountry, byRole,
        churchSignupTrend, userSignupTrend,
        usageTrend, usageByType,
        mostEngagedChurches,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/admin/analytics]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load analytics' } }, { status: 500 });
  }
}
