import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const p = await verifyToken(token);
  return p ? payloadToAuthUser(p) : null;
}

const ALLOWED = ['overseer', 'pa', 'lead_tech', 'partnership'];

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const res = await fetch(
    `${S}/rest/v1/partners?order=full_name.asc&select=id,full_name,phone,email,status,start_date,partnership_bands(name,amount,color)`,
    { headers: h() }
  );
  const partnersData = await res.json();

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const givingRes = await fetch(
    `${S}/rest/v1/partnership_giving?month=gte.${thisMonthStart.toISOString().split('T')[0]}&select=partner_id,amount,status`,
    { headers: h() }
  );
  const givingData = await givingRes.json();

  const allGivingRes = await fetch(`${S}/rest/v1/partnership_giving?select=partner_id,amount,month,status&order=month.desc`, { headers: h() });
  const allGiving = await allGivingRes.json();
  const givingByPartner = Array.isArray(allGiving) ? allGiving : [];

  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const partners = (Array.isArray(partnersData) ? partnersData : []).map((p: Record<string, unknown>) => {
    const band = p.partnership_bands as Record<string, unknown> | null;
    const own = givingByPartner.filter((g: Record<string, string>) => g.partner_id === p.id);
    const paidMonths = new Set(own.filter((g: Record<string, string>) => g.status === 'paid').map((g: Record<string, string>) => (g.month || '').slice(0, 7)));
    const thisMoPaid = paidMonths.has(monthKey(now));

    // Derive lapsed status from actual giving history — nothing writes 'lapsed' to
    // the DB directly, so compute it at read time: 2+ consecutive months with no
    // paid entry (counting back from now) counts as lapsed, regardless of `status`.
    let missedStreak = 0;
    while (missedStreak < 60 && !paidMonths.has(monthKey(new Date(now.getFullYear(), now.getMonth() - missedStreak, 1)))) {
      missedStreak++;
    }
    // Consecutive paid months immediately preceding the current gap (or, for an
    // active partner where missedStreak is 0, their current active giving streak).
    let monthsConsistent = 0;
    while (missedStreak + monthsConsistent < 60 && paidMonths.has(monthKey(new Date(now.getFullYear(), now.getMonth() - missedStreak - monthsConsistent, 1)))) {
      monthsConsistent++;
    }
    const effectiveStatus = p.status === 'inactive' ? 'inactive' : missedStreak >= 2 ? 'lapsed' : 'active';

    const totalGiven = own.reduce((a: number, g: Record<string, number>) => a + Number(g.amount || 0), 0);
    return {
      id: p.id, full_name: p.full_name, phone: p.phone, email: p.email,
      status: effectiveStatus, start_date: p.start_date,
      band_name: band?.name || '', band_amount: band?.amount || 0, band_color: band?.color || '#534AB7',
      this_month_paid: thisMoPaid, months_consistent: monthsConsistent, total_given: totalGiven,
    };
  });

  return NextResponse.json({ data: { partners }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const body = await req.json();
  const { full_name, phone, email, band_id, start_date } = body;
  const res = await fetch(`${S}/rest/v1/partners`, {
    method: 'POST',
    headers: { ...h(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ full_name, phone: phone || null, email: email || null, band_id, start_date, status: 'active' }),
  });
  const data = await res.json();
  return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null }, { status: 201 });
}
