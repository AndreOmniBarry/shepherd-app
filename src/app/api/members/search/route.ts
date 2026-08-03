import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` });

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const ALLOWED_ROLES = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech', 'fellowship_head', 'department_head', 'cell_leader', 'care_team'];
    if (!ALLOWED_ROLES.includes(String(payload.role))) {
      return NextResponse.json({ data: null, error: { message: 'Not authorized to search members' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    // Only the fully-privileged roles (already able to see every branch
    // from their own dashboard) may pick an arbitrary branch/fellowship via
    // query params. Every other role is pinned to their own scope — this
    // used to trust the client-supplied branch_id/fellowship_id for
    // cell_leader/fellowship_head/department_head/care_team too, which let
    // e.g. a cell leader pass any branch_id (or none) and pull full
    // name+phone for up to 200 members anywhere in the org, not just their
    // own cell.
    const FULL_ACCESS_ROLES = ['overseer', 'general_overseer', 'pa', 'lead_tech'];
    let branchId: string | null = null;
    let cellFilter = '';
    let fellowshipId: string | null = null;

    if (payload.role === 'branch_pastor') {
      branchId = payload.branch_id ?? null;
    } else if (payload.role === 'cell_leader') {
      cellFilter = payload.cell_id ? `&cell_id=eq.${payload.cell_id}` : '&cell_id=eq.00000000-0000-0000-0000-000000000000';
    } else if (payload.role === 'fellowship_head') {
      fellowshipId = payload.fellowship_id ?? null;
      if (!fellowshipId) cellFilter = '&cell_id=eq.00000000-0000-0000-0000-000000000000'; // no fellowship on file — show nothing rather than everything
    } else if (payload.role === 'department_head' || payload.role === 'care_team') {
      branchId = payload.branch_id ?? null; // branch-scoped if the account has one; unscoped only matters for single-branch churches
    } else if (FULL_ACCESS_ROLES.includes(String(payload.role))) {
      branchId = searchParams.get('branch_id');
      fellowshipId = searchParams.get('fellowship_id');
    }

    const branchFilter = branchId ? `&branch_id=eq.${branchId}` : '';
    const fellowshipFilter = fellowshipId ? `&fellowship_id=eq.${fellowshipId}` : '';

    const churchFilter = payload.church_id ? `&church_id=eq.${payload.church_id}` : '';
    const select = 'id,full_name,phone,membership_status,join_date,cells(name),fellowships(name)';
    let url = `${SUPABASE_URL}/rest/v1/members?select=${select}&order=join_date.desc.nullslast&limit=200${branchFilter}${fellowshipFilter}${cellFilter}${churchFilter}`;
    if (q.length >= 2) {
      url = `${SUPABASE_URL}/rest/v1/members?full_name=ilike.*${q}*&select=${select}&order=full_name.asc&limit=50${branchFilter}${fellowshipFilter}${cellFilter}${churchFilter}`;
    }

    const res = await fetch(url, { headers: hdrs() });
    const data = await res.json();
    const members = (Array.isArray(data) ? data : []).map((m: Record<string, unknown>) => ({
      id: m.id,
      full_name: m.full_name,
      phone: m.phone,
      membership_status: m.membership_status,
      join_date: m.join_date,
      cell_name: (m.cells as Record<string, string> | null)?.name || null,
      fellowship_name: (m.fellowships as Record<string, string> | null)?.name || null,
    }));
    return NextResponse.json({ data: { members }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to search members' } }, { status: 500 });
  }
}
