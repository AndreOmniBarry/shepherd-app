export const dynamic = 'force-dynamic';
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

export async function GET() {
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

  const allGivingRes = await fetch(`${S}/rest/v1/partnership_giving?select=partner_id,amount`, { headers: h() });
  const allGiving = await allGivingRes.json();

  const partners = (Array.isArray(partnersData) ? partnersData : []).map((p: Record<string, unknown>) => {
    const band = p.partnership_bands as Record<string, unknown> | null;
    const thisMoPaid = Array.isArray(givingData)
      ? givingData.some((g: Record<string, string>) => g.partner_id === p.id && g.status === 'paid')
      : false;
    const totalGiven = Array.isArray(allGiving)
      ? allGiving.filter((g: Record<string, string>) => g.partner_id === p.id)
          .reduce((a: number, g: Record<string, number>) => a + g.amount, 0)
      : 0;
    return {
      id: p.id, full_name: p.full_name, phone: p.phone, email: p.email,
      status: p.status, start_date: p.start_date,
      band_name: band?.name || '', band_amount: band?.amount || 0, band_color: band?.color || '#534AB7',
      this_month_paid: thisMoPaid, months_consistent: 0, total_given: totalGiven,
    };
  });

  return NextResponse.json({ data: { partners }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
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
