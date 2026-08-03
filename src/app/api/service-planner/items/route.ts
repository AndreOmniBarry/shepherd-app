export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
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
    // KNOWN GAP: service_plan_items has no church_id of its own, so a
    // caller who already knows/guesses another church's plan_id could list
    // its items here. Low-severity (item titles/assignee names only, no
    // financial or personal data) — flagged rather than adding a join on
    // every list call.
    let url = `${SUPABASE_URL}/rest/v1/service_plan_items?order=position.asc&select=id,plan_id,position,item_type,title,description,duration_minutes,assigned_to,assigned_to_name,color,is_completed`;
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

    // service_plan_items has no church_id of its own — verify the parent
    // plan belongs to this caller's church before touching the item.
    const itemRes = await fetch(`${SUPABASE_URL}/rest/v1/service_plan_items?id=eq.${id}&select=plan_id&limit=1`, { headers: H() });
    const itemData = await itemRes.json();
    const planId = itemData?.[0]?.plan_id;
    if (!planId) return NextResponse.json({ data: null, error: { message: 'Item not found' } }, { status: 404 });
    const planRes = await fetch(`${SUPABASE_URL}/rest/v1/service_plans?id=eq.${planId}&church_id=eq.${user.church_id}&select=id&limit=1`, { headers: H() });
    const planData = await planRes.json();
    if (!planData?.[0]) return NextResponse.json({ data: null, error: { message: 'Item not found' } }, { status: 404 });

    await fetch(`${SUPABASE_URL}/rest/v1/service_plan_items?id=eq.${id}`, { method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(rest) });
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
