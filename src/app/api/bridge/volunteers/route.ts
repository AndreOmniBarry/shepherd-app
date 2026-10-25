export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// Volunteer sign-ups that arrived from the TCH website bridge
// (web_volunteer_interest, scripts/84_tch_website_bridge.sql). Church
// admins see every row for their church; a department head sees only rows
// whose mapped department_ids include their own department. Regular
// authenticated route — the middleware exempts only POST /api/bridge/ingest.

const ADMIN_ROLES = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];
const STATUSES = ['new', 'contacted', 'placed', 'declined', 'archived'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns the PostgREST filter that scopes rows to what this user may see,
// or null if they may see none.
async function scopeFilter(user: { id: string; role: string; church_id?: string | null }): Promise<string | null> {
  if (!user.church_id) return null;
  const church = `church_id=eq.${user.church_id}`;
  if (ADMIN_ROLES.includes(user.role)) return church;
  if (user.role !== 'department_head') return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&church_id=eq.${user.church_id}&select=department_id&limit=1`, { headers: hdrs() });
  const rows = await res.json().catch(() => null);
  const deptId = Array.isArray(rows) ? rows[0]?.department_id : null;
  if (!deptId || !UUID_RE.test(deptId)) return null;
  return `${church}&department_ids=cs.%7B${deptId}%7D`;
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const scope = await scopeFilter(user);
    if (!scope) return NextResponse.json({ data: { volunteers: [] }, error: null });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const statusFilter = status && STATUSES.includes(status) ? `&status=eq.${status}` : '&status=neq.archived';

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/web_volunteer_interest?${scope}${statusFilter}&order=created_at.desc&limit=200&select=id,full_name,email,phone,teams,team_idea,department_ids,notes,status,created_at`,
      { headers: hdrs() }
    );
    const rows = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(rows)) {
      return NextResponse.json({ data: null, error: { message: 'Failed to load volunteers' } }, { status: 500 });
    }
    return NextResponse.json({ data: { volunteers: rows }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Failed to load volunteers' } }, { status: 500 });
  }
}

// PATCH { id, status } — move a sign-up along (contacted / placed / ...).
export async function PATCH(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const scope = await scopeFilter(user);
    if (!scope) return NextResponse.json({ data: null, error: { message: 'Not authorized' } }, { status: 403 });

    const body = await req.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!UUID_RE.test(id) || !STATUSES.includes(status)) {
      return NextResponse.json({ data: null, error: { message: 'Invalid request' } }, { status: 400 });
    }

    // The scope filter on the PATCH itself means a row outside the caller's
    // church/department simply matches nothing.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/web_volunteer_interest?id=eq.${id}&${scope}`, {
      method: 'PATCH',
      headers: { ...hdrs(), Prefer: 'return=representation' },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    });
    const rows = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(rows) || !rows[0]) {
      return NextResponse.json({ data: null, error: { message: 'Volunteer not found' } }, { status: 404 });
    }
    return NextResponse.json({ data: { updated: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Failed to update' } }, { status: 500 });
  }
}
