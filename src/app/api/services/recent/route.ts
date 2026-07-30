import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Most recent date (on or before `from`) that falls on `dayIndex` (0=Sun..6=Sat).
function mostRecentOccurrence(from: Date, dayIndex: number): Date {
  const d = new Date(from);
  const diff = (d.getDay() - dayIndex + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

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
      // Sentient to the church's actual configured service days (Settings >
      // Church) instead of hardcoding Sunday-only — a church running Sunday
      // + Wednesday gets a midweek entry auto-created too, only once that
      // day has actually arrived (never a future date).
      const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/church_config?select=service_days&limit=1`, { headers });
      const cfgData = await cfgRes.json();
      const serviceDays: string[] = cfgData?.[0]?.service_days?.length ? cfgData[0].service_days : ['Sunday'];

      const created: Record<string, unknown>[] = [];
      for (const dayName of serviceDays) {
        const dayIndex = DAY_NAMES.indexOf(dayName);
        if (dayIndex === -1) continue;
        const occurrence = mostRecentOccurrence(lagosNow, dayIndex);
        const dateStr = occurrence.toISOString().split('T')[0];
        const serviceType = dayIndex === 0 ? 'sunday' : 'midweek';

        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/services?service_date=eq.${dateStr}&service_number=eq.1&select=id,service_date,service_number,service_type&limit=1`,
          { headers }
        );
        const existing = await checkRes.json();
        if (existing?.[0]) { created.push(existing[0]); continue; }

        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ service_date: dateStr, service_number: 1, service_type: serviceType, notes: 'Auto-created by SHEP.HERD' }),
        });
        const inserted = await insertRes.json();
        created.push(Array.isArray(inserted) && inserted[0] ? inserted[0] : { id: `virtual-${dateStr}-1`, service_date: dateStr, service_number: 1, service_type: serviceType });
      }
      services = created;
    }

    // Add display label to each service — no toLocaleDateString (unreliable on server)
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const labelled = services.map((s: Record<string, string>) => {
      const [y, mo, d] = s.service_date.split('-').map(Number);
      const date = new Date(y, mo - 1, d);
      const dayName = DAYS[date.getDay()];
      const monthName = MONTHS_NAMES[mo - 1];
      const dateStr = `${d} ${monthName} ${y}`;
      const isMidweek = s.service_type === 'midweek';
      const isSunday = s.service_type === 'sunday';
      // Special/one-off days (congress, convention, vigil, etc) carry their
      // own label in `notes` — anything outside the two recurring types.
      const specialLabel = !isMidweek && !isSunday ? (s.notes || dayName) : null;
      return {
        ...s,
        label: specialLabel ? `${dateStr} — ${specialLabel}` : isMidweek ? `${dateStr} — Midweek Service` : `${dateStr} — Sunday Service`,
        is_midweek: isMidweek,
        is_special: !!specialLabel,
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
    const payload = await verifyToken(match[1]);
    if (!payload || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(String(payload.role))) {
      return NextResponse.json({ data: null, error: { message: 'Only admins can create a special service day' } }, { status: 403 });
    }

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
