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
    const res = await fetch(`${SURL}/rest/v1/church_events?public_slug=eq.${encodeURIComponent(slug)}&limit=1&select=id,title,description,event_type,event_date,start_time,end_time,location,is_free,price,capacity,banner_url,registration_open,status`, { headers: H() });
    const data = await res.json();
    const event = data?.[0];
    if (!event) return NextResponse.json({ data: null, error: { message: 'Not found' } }, { status: 404 });
    const countRes = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${event.id}&select=count`, { headers: { ...H(), 'Prefer': 'count=exact' } });
    const count = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0');
    return NextResponse.json({ data: { event: { ...event, registration_count: count } }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
