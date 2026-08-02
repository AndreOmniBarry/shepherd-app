export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) return NextResponse.json({ data: null, error: { message: 'slug required' } }, { status: 400 });
    const res = await fetch(`${SURL}/rest/v1/church_events?public_slug=eq.${encodeURIComponent(slug)}&limit=1&select=id,title,description,event_type,event_date,end_date,start_time,end_time,location,is_free,price,capacity,banner_url,registration_open,status`, { headers: H() });
    const data = await res.json();
    const event = data?.[0];
    if (!event) return NextResponse.json({ data: null, error: { message: 'Not found' } }, { status: 404 });
    const countRes = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${event.id}&select=count`, { headers: { ...H(), 'Prefer': 'count=exact' } });
    const count = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0');

    let currency = 'NGN';
    let logoUrl: string | null = null;
    try {
      const configRes = await fetch(`${SURL}/rest/v1/church_config?order=created_at.asc&limit=1&select=currency,logo_url`, { headers: H() });
      const configs = await configRes.json();
      currency = (Array.isArray(configs) && configs[0]?.currency) || 'NGN';
      logoUrl = (Array.isArray(configs) && configs[0]?.logo_url) || null;
    } catch { /* default to NGN/no logo if config lookup fails */ }

    // The link stops accepting registrations once the program's last day
    // has passed — automatic, doesn't rely on an admin remembering to
    // toggle anything — on top of the existing manual registration_open
    // flag an admin can flip off any time (e.g. to collapse it early).
    const lastDay = event.end_date || event.event_date;
    const today = new Date().toISOString().split('T')[0];
    const ended = lastDay < today;

    // Multi-day range, for the registration form's day-selection.
    const days: string[] = [];
    if (event.end_date && event.end_date > event.event_date) {
      const cur = new Date(event.event_date + 'T00:00:00');
      const end = new Date(event.end_date + 'T00:00:00');
      while (cur <= end) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }
    }

    return NextResponse.json({ data: { event: { ...event, registration_count: count, registration_open: event.registration_open && !ended, ended, days }, currency, logo_url: logoUrl }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
