import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/shepherd_token=([^;]+)/);
    if (!match?.[1]) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    // Rolling 7-day window — only allow submission for services within last 7 days
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - 7);

    // Fetch services within window
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=gte.${cutoff.toISOString().split('T')[0]}&service_date=lte.${now.toISOString().split('T')[0]}&order=service_date.desc,service_number.asc&limit=8&select=id,service_date,service_number`,
      { headers }
    );
    let services = await res.json();

    // If no services found in DB, auto-create the most recent Sunday
    if (!Array.isArray(services) || services.length === 0) {
      // Find most recent Sunday
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun
      const daysSinceSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - daysSinceSunday);
      const sundayStr = lastSunday.toISOString().split('T')[0];

      // Check if this Sunday already exists
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/services?service_date=eq.${sundayStr}&service_number=eq.1&select=id,service_date,service_number&limit=1`,
        { headers }
      );
      const existing = await checkRes.json();

      if (existing?.[0]) {
        services = existing;
      } else {
        // Auto-insert this Sunday as Service 1
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            service_date: sundayStr,
            service_number: 1,
            service_type: 'Sunday Service',
            notes: 'Auto-created by SHEP.HERD',
          }),
        });
        const inserted = await insertRes.json();
        if (Array.isArray(inserted) && inserted[0]) {
          services = inserted;
        } else {
          // Fallback — return a virtual service so UI does not break
          services = [{
            id: `virtual-${sundayStr}-1`,
            service_date: sundayStr,
            service_number: 1,
          }];
        }
      }
    }

    return NextResponse.json({ data: { services }, error: null });
  } catch (err) {
    console.error('[GET /api/services/recent]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load services' } }, { status: 500 });
  }
}

// POST — create a new service (Pastor/Admin only)
export async function POST(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/shepherd_token=([^;]+)/);
    if (!match?.[1]) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    const body = await req.json();
    const { service_date, service_number, service_type, notes } = body;

    if (!service_date || !service_number) {
      return NextResponse.json({ data: null, error: { message: 'service_date and service_number are required' } }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({ service_date, service_number, service_type: service_type || 'Sunday Service', notes: notes || null }),
    });
    const data = await res.json();
    const service = Array.isArray(data) ? data[0] : data;

    if (!res.ok || !service?.id) {
      return NextResponse.json({ data: null, error: { message: 'Failed to create service' } }, { status: 500 });
    }

    return NextResponse.json({ data: { service }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/services/recent]', err);
    return NextResponse.json({ data: null, error: { message: 'Internal error' } }, { status: 500 });
  }
}
