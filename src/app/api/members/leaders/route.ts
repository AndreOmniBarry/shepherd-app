export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { resolveBranchScope } from '@/lib/branch-scope';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Leaders eligible to be commended — cell leaders, fellowship heads, department heads.
// Only called from the pastor/PA/tech dashboard and its Special Service
// panel — never from a leader's own portal — so it's scoped to the same
// roles as its sibling roster endpoints (/departments/all, /cells/all,
// /fellowships/all), not "any authenticated user" (which previously let
// e.g. a workforce or care_team account enumerate every leader org-wide).
const ALLOWED_ROLES = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { branchFilter, forbidden } = resolveBranchScope(user, searchParams);
    if (forbidden) {
      return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=id,full_name,role,cell_id,fellowship_id,department_id&role=in.(cell_leader,fellowship_head,department_head)&order=full_name.asc${branchFilter}&church_id=eq.${user.church_id}`,
      { headers: hdrs() }
    );
    const data = await res.json();
    return NextResponse.json({ data: { leaders: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    console.error('[GET /api/members/leaders]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load leaders' } }, { status: 500 });
  }
}
