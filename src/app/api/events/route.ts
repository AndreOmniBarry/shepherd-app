export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

function slug(title: string, date: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${date.replace(/-/g, '')}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const upcoming = searchParams.get('upcoming') === 'true';
    const today = new Date().toISOString().split('T')[0];
    let url = `${SURL}/rest/v1/church_events?order=event_date.desc&limit=50&select=id,title,event_type,event_date,start_time,end_time,location,is_free,price,capacity,banner_url,public_slug,registration_open,status,created_at`;
    if (upcoming) url = `${SURL}/rest/v1/church_events?event_date=gte.${today}&status=neq.cancelled&order=event_date.asc&limit=10&select=id,title,event_type,event_date,start_time,location,is_free,price,capacity,public_slug,registration_open,status`;
    const res = await fetch(url, { headers: H() });
    const events = await res.json();
    // Get registration counts
    const withCounts = await Promise.all((Array.isArray(events) ? events : []).map(async (e: Record<string,unknown>) => {
      const cr = await fetch(`${SURL}/rest/v1/event_registrations?event_id=eq.${e.id}&select=count`, { headers: { ...H(), 'Prefer': 'count=exact' } });
      const count = parseInt(cr.headers.get('content-range')?.split('/')[1] || '0');
      return { ...e, registration_count: count };
    }));
    return NextResponse.json({ data: { events: withCounts }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['overseer','pa','lead_tech'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    const body = await req.json();
    const { title, event_date, description, event_type, start_time, end_time, location, is_free, price, capacity, banner_url, whatsapp_confirmation, sms_confirmation } = body;
    if (!title || !event_date) return NextResponse.json({ data: null, error: { message: 'Title and date required' } }, { status: 400 });
    const public_slug = slug(title, event_date);
    const res = await fetch(`${SURL}/rest/v1/church_events`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ title, event_date, description: description || null, event_type: event_type || 'programme', start_time: start_time || null, end_time: end_time || null, location: location || null, is_free: is_free ?? true, price: is_free ? 0 : (price || 0), capacity: capacity || null, banner_url: banner_url || null, public_slug, registration_open: true, whatsapp_confirmation: whatsapp_confirmation ?? true, sms_confirmation: sms_confirmation ?? true, status: 'upcoming', created_by: user.id }),
    });
    const data = await res.json();
    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['overseer','pa','lead_tech'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    const { id, ...rest } = await req.json();
    await fetch(`${SURL}/rest/v1/church_events?id=eq.${id}`, { method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify({ ...rest, updated_at: new Date().toISOString() }) });
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
