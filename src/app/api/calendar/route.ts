export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Church-wide calendar — every role can see it. Deliberately shows only
// non-routine dates (created programmes + special service days), not
// every regular Sunday/midweek service, so it stays readable rather than
// a chip on every single week. Only ever surfaces the church's own real
// created events — never fabricated public/religious holidays, since
// getting one of those dates wrong would be worse than not showing it.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const to = searchParams.get('to') || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];

    const [eventsRes, specialRes, plansRes] = await Promise.all([
      fetch(`${SURL}/rest/v1/church_events?event_date=gte.${from}&event_date=lte.${to}&status=neq.cancelled&order=event_date.asc&select=id,title,event_type,event_date,end_date,location,public_slug`, { headers: H() }),
      fetch(`${SURL}/rest/v1/services?service_type=eq.special&service_date=gte.${from}&service_date=lte.${to}&order=service_date.asc&select=id,service_date,notes`, { headers: H() }),
      // Published order-of-service programmes — everyone can see who's
      // anchoring what, not just the individually-assigned person.
      fetch(`${SURL}/rest/v1/service_plans?status=eq.published&service_date=gte.${from}&service_date=lte.${to}&order=service_date.asc&select=id,service_date,title,theme`, { headers: H() }),
    ]);
    const events = await eventsRes.json();
    const special = await specialRes.json();
    const plans = await plansRes.json();

    const items = [
      ...(Array.isArray(events) ? events : []).map((e: Record<string, unknown>) => ({
        id: `event-${e.id}`, title: e.title as string, date: e.event_date as string, end_date: (e.end_date as string) || null,
        type: e.event_type as string, source: 'event' as const, location: e.location as string | null, slug: e.public_slug as string | null,
      })),
      ...(Array.isArray(special) ? special : []).map((s: Record<string, unknown>) => ({
        id: `special-${s.id}`, title: (s.notes as string) || 'Special service', date: s.service_date as string, end_date: null,
        type: 'special', source: 'service' as const, location: null, slug: null,
      })),
      ...(Array.isArray(plans) ? plans : []).map((p: Record<string, unknown>) => ({
        id: `plan-${p.id}`, title: `${p.title as string}${p.theme ? ` — ${p.theme}` : ''}`, date: p.service_date as string, end_date: null,
        type: 'order_of_service', source: 'plan' as const, location: null, slug: null, plan_id: p.id as string,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ data: { items }, error: null });
  } catch (err) {
    console.error('[GET /api/calendar]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load calendar' } }, { status: 500 });
  }
}
