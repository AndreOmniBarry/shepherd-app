export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { isBranchScopedMandatory } from '@/lib/branch-scope';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Creates a tier-1 structure entity (Fellowship/Zone/Campus/Department/
// Network, per the church's own structure_type — always the `fellowships`
// table underneath, same structure-agnostic convention as everywhere else
// in this codebase).
//
// This route did not exist until now — found live, driving a real signup
// end to end. bootstrapChurch() (church-config/route.ts) auto-creates
// exactly one fellowship+cell pair, but ONLY for structure_type 'single'.
// Every other structure (cell_church — the default, and per the /setup
// wizard's own copy the most common type; zonal; campus; department;
// house_network) left a brand-new church with zero tier-1 entities and no
// way to create one anywhere in the app: "Create Cell"/"Create District"/
// etc. all require picking an existing parent from a dropdown that was
// permanently empty, and neither Settings' "Church Structure" tab (labels
// only) nor any other page had a creation flow. Mirrors POST
// /api/cells/create's own pattern one level up — no fellowship_id concept
// here, just church_id + optional branch_id.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'pa', 'lead_tech', 'branch_pastor'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: `Not authorized to create a fellowship` } }, { status: 403 });
    }

    const body = await req.json();
    const { name, branch_id: bodyBranchId } = body as { name?: string; branch_id?: string };
    if (!name?.trim()) return NextResponse.json({ data: null, error: { message: 'Name is required' } }, { status: 400 });

    // Same shape as /api/cells/create's own branch_id handling: a
    // mandatorily branch-scoped role (branch_pastor) always gets their own
    // branch — never an explicit choice. Every other allowed role here may
    // pass an explicit branch_id (validated against their own church) or
    // omit it entirely (a church with no branch concept in play).
    let branch_id: string | null = bodyBranchId || null;
    if (isBranchScopedMandatory(user.role)) {
      branch_id = user.branch_id ?? null;
      if (!branch_id) return NextResponse.json({ data: null, error: { message: 'No branch assigned to your account' } }, { status: 400 });
    } else if (branch_id) {
      const branchCheck = await fetch(
        `${SUPABASE_URL}/rest/v1/branches?id=eq.${branch_id}&church_id=eq.${user.church_id}&select=id&limit=1`,
        { headers: hdrs() }
      ).then(r => r.json());
      if (!branchCheck?.[0]) return NextResponse.json({ data: null, error: { message: 'Branch not found' } }, { status: 404 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/fellowships`, {
      method: 'POST',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        name: name.trim(),
        church_id: user.church_id || null,
        branch_id: branch_id || null,
      }),
    });
    const data = await res.json();
    const fellowship = Array.isArray(data) ? data[0] : data;
    if (!res.ok || !fellowship?.id) {
      console.error('[POST /api/fellowships/create]', data);
      return NextResponse.json({ data: null, error: { message: 'Failed to create fellowship' } }, { status: 500 });
    }
    return NextResponse.json({ data: { fellowship }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/fellowships/create]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create fellowship' } }, { status: 500 });
  }
}
