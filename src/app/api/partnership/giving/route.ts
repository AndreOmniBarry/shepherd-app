import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { computeSlaGrade } from '@/lib/sla';

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

// SLA here measures how promptly partnership logged the giving entry after
// the month it's attributed to — the same "logged promptly" metric accounts
// uses for income, so both staff-facing roles are graded the same way.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const res = await fetch(
    `${S}/rest/v1/partnership_giving?month=gte.${cutoff.toISOString().split('T')[0]}&order=month.desc&limit=200&select=id,partner_id,amount,month,status,notes,created_at,partners(full_name)`,
    { headers: h() }
  );
  const data = await res.json();
  const records = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    ...r,
    partner_name: (r.partners as Record<string, string> | null)?.full_name || '',
    sla_grade: r.month && r.created_at ? computeSlaGrade(r.month as string, r.created_at as string) : null,
  }));
  return NextResponse.json({ data: { records }, error: null });
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const body = await req.json();
  const { partner_id, amount, month, status, notes } = body;
  const res = await fetch(`${S}/rest/v1/partnership_giving`, {
    method: 'POST',
    headers: { ...h(), 'Prefer': 'return=representation' },
    body: JSON.stringify({
      partner_id, amount: parseFloat(amount),
      month, status: status || 'paid',
      notes: notes || null, submitted_by: user.id,
    }),
  });
  const data = await res.json();
  const giving = Array.isArray(data) ? data[0] : data;
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://shepherd-app-beta.vercel.app'}/api/notify/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_SECRET || '' },
    body: JSON.stringify({
      event: 'partnership_giving_logged',
      actor_name: user.id,
      actor_role: user.role,
      detail: `Partnership giving logged — ${Number(body.amount || 0).toLocaleString()}`,
      amount: parseFloat(body.amount) || 0,
    }),
  }).catch(() => {});
  return NextResponse.json({ data: giving, error: null }, { status: 201 });
}
