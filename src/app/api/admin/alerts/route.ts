import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const p = await verifyToken(token);
  return p ? payloadToAuthUser(p) : null;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, medium: 1, low: 2 };

// lead_tech only, not overseer — overseer is a per-church role, and this
// triage board is genuinely platform-wide across every church. Same gate
// as /api/admin/churches, which lives on the same SaaS-level panel.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  if (!['lead_tech'].includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }

  const url = new URL(req.url);
  const includeResolved = url.searchParams.get('include_resolved') === 'true';
  const statusFilter = includeResolved ? '' : '&status=neq.resolved';

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/system_alerts?select=*,church_config(church_name)${statusFilter}&order=created_at.desc&limit=200`,
    { headers: hdrs() }
  );
  const data = await res.json();
  type RawAlert = {
    id: string; church_id: string | null; severity: string; category: string;
    title: string; detail: string; status: string; created_at: string;
    church_config: { church_name?: string } | null;
  };
  const alerts = (Array.isArray(data) ? data as RawAlert[] : []).map(a => ({
    id: a.id, church_id: a.church_id, severity: a.severity, category: a.category,
    title: a.title, detail: a.detail, status: a.status, created_at: a.created_at,
    church_name: a.church_config?.church_name || null,
  }));
  alerts.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  const counts = { critical: 0, medium: 0, low: 0 };
  for (const a of alerts) {
    if (a.status === 'resolved') continue;
    if (a.severity === 'critical') counts.critical++;
    else if (a.severity === 'medium') counts.medium++;
    else if (a.severity === 'low') counts.low++;
  }

  return NextResponse.json({ data: { alerts, counts }, error: null });
}

export async function PATCH(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  if (!['lead_tech'].includes(user.role)) {
    return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
  }

  const body = await req.json();
  const { id, status } = body as { id?: string; status?: string };
  if (!id || !['acknowledged', 'resolved', 'open'].includes(status || '')) {
    return NextResponse.json({ data: null, error: { message: 'id and a valid status are required' } }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'resolved') patch.resolved_at = new Date().toISOString();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/system_alerts?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...hdrs(), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  return NextResponse.json({ data: Array.isArray(data) ? data[0] : data, error: null });
}
