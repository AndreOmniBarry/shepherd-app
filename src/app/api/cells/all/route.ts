import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { resolveBranchScope } from '@/lib/branch-scope';
import { buildCellScores } from '@/lib/leadership-sla';

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1] || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);
    if (!['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

    // Branch scoping: branch_pastor is always locked to their own branch;
    // everyone else can pass ?branch_id= to drill in, or omit it for the
    // consolidated all-branches view.
    const { searchParams } = new URL(req.url);
    const { branchFilter, forbidden } = resolveBranchScope(user, searchParams);
    if (forbidden) {
      return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
    }

    // Per-cell composite score (attendance rate, dispute-free accuracy,
    // growth, submission and meeting promptness) — extracted to
    // src/lib/leadership-sla.ts so the fellowship-head rollup can reuse
    // the exact same computation instead of a second, divergent one. Same
    // fetches, same weights, same output as before this extraction.
    const result = await buildCellScores({
      supabaseUrl: SUPABASE_URL,
      headers,
      churchId: user.church_id,
      extraCellsFilter: branchFilter,
    });

    return NextResponse.json({ data: { cells: result }, error: null });
  } catch (err) {
    console.error('[GET /api/cells/all]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load cells' } }, { status: 500 });
  }
}
