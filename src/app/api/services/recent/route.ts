import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/shepherd_token=([^;]+)/);
    if (!match?.[1]) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Get last 4 Sundays worth of services
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=gte.${cutoff.toISOString().split('T')[0]}&order=service_date.desc,service_number.asc&limit=8&select=id,service_date,service_number`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    );

    const services = await res.json();
    return NextResponse.json({ data: { services: services || [] }, error: null });
  } catch (err) {
    console.error('[GET /api/services/recent]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load services' } }, { status: 500 });
  }
}
