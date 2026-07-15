import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/shepherd_token=([^;]+)/);
    if (!match?.[1]) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    const now = new Date();
    // Use Lagos time (UTC+1) to avoid date drift
    const lagosOffset = 60; // minutes
    const lagosNow = new Date(now.getTime() + lagosOffset * 60000);
    const todayStr = lagosNow.toISOString().split('T')[0];
    const cutoffDate = new Date(lagosNow.getTime() - 7 * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_date=gte.${cutoffStr}&service_date=lte.${todayStr}&order=service_date.desc,service_number.asc&limit=10&select=id,service_date,service_number,service_type`,
      { headers }
    );
    let services = await res.json();

    if (!Array.isArray(services) || services.length === 0) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysSinceSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - daysSinceSunday);
      const sundayStr = lastSunday.toISOString().split('T')[0];

      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/services?service_date=eq.${sundayStr}&service_number=eq.1&select=id,service_date,service_number,service_type&limit=1`,
        { headers }
      );
      const existing = await checkRes.json();

      if (existing?.[0]) {
        services = existing;
      } else {
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ service_date: sundayStr, service_number: 1, service_type: 'sunday', notes: 'Auto-created by SHEP.HERD' }),
        });
        const inserted = await insertRes.json();
        services = Array.isArray(inserted) && inserted[0] ? inserted : [{ id: `virtual-${sundayStr}-1`, service_date: sundayStr, service_number: 1, service_type: 'sunday' }];
      }
    }

    // Add display label to each service — no toLocaleDateString (unreliable on server)
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const labelled = services.map((s: Record<string, string>) => {
      const [y, mo, d] = s.service_date.split('-').map(Number);
      const date = new Date(y, mo - 1, d);
      const dayName = DAYS[date.getDay()];
      const monthName = MONTHS_NAMES[mo - 1];
      const dateStr = `${dayName}, ${d} ${monthName} ${y}`;
      const isMidweek = s.service_type === 'midweek';
      return {
        ...s,
        label: isMidweek ? `${dateStr} — Midweek Service` : `${dateStr} — Sunday Service`,
        is_midweek: isMidweek,
      };
    });

    return NextResponse.json({ data: { services: labelled }, error: null });
  } catch (err) {
    console.error('[GET /api/services/recent]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load services' } }, { status: 500 });
  }
}

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
      body: JSON.stringify({ service_date, service_number, service_type: service_type || 'sunday', notes: notes || null }),
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
