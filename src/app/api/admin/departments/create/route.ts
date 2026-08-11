export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { isBranchScopedMandatory } from '@/lib/branch-scope';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const { name, branch_id: bodyBranchId } = await req.json();
    if (!name?.trim()) return NextResponse.json({ data: null, error: { message: 'Department name is required' } }, { status: 400 });

    // Same pattern as cells/create: a mandatorily branch-scoped role
    // (branch_pastor) always lands the new department in their own branch;
    // every other allowed role here may pass an explicit branch_id
    // (validated against their own church) or omit it.
    let branch_id: string | null = bodyBranchId || null;
    if (isBranchScopedMandatory(user.role)) {
      branch_id = user.branch_id ?? null;
      if (!branch_id) return NextResponse.json({ data: null, error: { message: 'No branch assigned to your account' } }, { status: 400 });
    } else if (branch_id) {
      const branchCheck = await fetch(
        `${SURL}/rest/v1/branches?id=eq.${branch_id}&church_id=eq.${user.church_id}&select=id&limit=1`,
        { headers: H() }
      ).then(r => r.json());
      if (!branchCheck?.[0]) return NextResponse.json({ data: null, error: { message: 'Branch not found' } }, { status: 404 });
    }

    const res = await fetch(`${SURL}/rest/v1/departments`, {
      method: 'POST', headers: { ...H(), Prefer: 'return=representation' },
      body: JSON.stringify({ name: name.trim(), church_id: user.church_id || null, branch_id: branch_id || null }),
    });
    const data = await res.json();
    const department = Array.isArray(data) ? data[0] : data;
    if (!res.ok || !department?.id) {
      console.error('[POST /api/admin/departments/create] Supabase error:', res.status, JSON.stringify(data));
      const detail = data?.message || data?.hint || data?.details;
      return NextResponse.json({ data: null, error: { message: detail ? `Failed to create department: ${detail}` : 'Failed to create department' } }, { status: 500 });
    }
    return NextResponse.json({ data: { department }, error: null }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/departments/create]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to create department' } }, { status: 500 });
  }
}
