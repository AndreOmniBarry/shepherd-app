import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const plan_id = searchParams.get('plan_id');
    const assigned_to = searchParams.get('assigned_to');
    let url = `${URL}/rest/v1/service_plan_items?order=position.asc&select=id,plan_id,position,item_type,title,description,duration_minutes,assigned_to,assigned_to_name,color,is_completed`;
    if (plan_id) url += `&plan_id=eq.${plan_id}`;
    if (assigned_to) url += `&assigned_to=eq.${assigned_to}`;
    const res = await fetch(url, { headers: H() });
    const items = await res.json();
    return NextResponse.json({ data: { items: Array.isArray(items) ? items : [] }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const { id, ...rest } = await req.json();
    await fetch(`${URL}/rest/v1/service_plan_items?id=eq.${id}`, { method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(rest) });
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
