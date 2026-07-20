export const dynamic = 'force-dynamic';
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
    const upcoming = searchParams.get('upcoming') === 'true';
    const today = new Date().toISOString().split('T')[0];
    let url = `${URL}/rest/v1/service_plans?order=service_date.desc&limit=20&select=id,service_date,service_type,title,theme,status,created_by,published_at,created_at`;
    if (upcoming) url = `${URL}/rest/v1/service_plans?service_date=gte.${today}&order=service_date.asc&limit=5&select=id,service_date,service_type,title,theme,status,published_at`;
    const res = await fetch(url, { headers: H() });
    const plans = await res.json();
    return NextResponse.json({ data: { plans: Array.isArray(plans) ? plans : [] }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['overseer','pa','lead_tech'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Only PA or Overseer can create service plans' } }, { status: 403 });
    const body = await req.json();
    const { service_date, service_type, title, theme, items } = body;
    if (!service_date || !title) return NextResponse.json({ data: null, error: { message: 'Date and title required' } }, { status: 400 });
    const planRes = await fetch(`${URL}/rest/v1/service_plans`, {
      method: 'POST', headers: { ...H(), 'Prefer': 'return=representation' },
      body: JSON.stringify({ service_date, service_type: service_type || 'sunday', title, theme: theme || null, status: 'draft', created_by: user.id }),
    });
    const planData = await planRes.json();
    const plan = Array.isArray(planData) ? planData[0] : planData;
    if (items?.length > 0) {
      const itemRows = items.map((item: Record<string,unknown>, i: number) => ({ plan_id: plan.id, position: i, ...item }));
      await fetch(`${URL}/rest/v1/service_plan_items`, { method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(itemRows) });
    }
    return NextResponse.json({ data: { plan }, error: null }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['overseer','pa','lead_tech'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    const { id, status, items, ...rest } = await req.json();
    const payload: Record<string,unknown> = { ...rest, updated_at: new Date().toISOString() };
    if (status) {
      payload.status = status;
      if (status === 'published') payload.published_at = new Date().toISOString();
    }
    await fetch(`${URL}/rest/v1/service_plans?id=eq.${id}`, { method: 'PATCH', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(payload) });
    if (items) {
      await fetch(`${URL}/rest/v1/service_plan_items?plan_id=eq.${id}`, { method: 'DELETE', headers: H() });
      if (items.length > 0) {
        const rows = items.map((item: Record<string,unknown>, i: number) => ({ plan_id: id, position: i, ...item }));
        await fetch(`${URL}/rest/v1/service_plan_items`, { method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(rows) });
      }
    }
    if (status === 'published') {
      // Notify all assigned users
      try {
        const itemsRes = await fetch(`${URL}/rest/v1/service_plan_items?plan_id=eq.${id}&assigned_to=not.is.null&select=assigned_to,title`, { headers: H() });
        const assignedItems = await itemsRes.json();
        if (Array.isArray(assignedItems) && assignedItems.length > 0) {
          const notifications = assignedItems.map((i: Record<string,unknown>) => ({
            user_id: i.assigned_to, type: 'service', read: false,
            title: 'You have a role in Sunday\'s service',
            body: `You are assigned to: ${i.title}. Check My Assignments for the full programme.`,
          }));
          await fetch(`${URL}/rest/v1/notifications`, { method: 'POST', headers: { ...H(), 'Prefer': 'return=minimal' }, body: JSON.stringify(notifications) });
        }
      } catch {}
    }
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch { return NextResponse.json({ data: null, error: { message: 'Failed' } }, { status: 500 }); }
}
