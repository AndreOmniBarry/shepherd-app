export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Who a person can request a meeting with — every other active account in
// their own branch (general_overseer/lead_tech see everyone, since they
// aren't tied to one branch).
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const branchFilter = user.branch_id && !['general_overseer', 'lead_tech'].includes(user.role) ? `&branch_id=eq.${user.branch_id}` : '';
    const res = await fetch(`${SURL}/rest/v1/users?is_active=eq.true&id=neq.${user.id}&select=id,full_name,role&order=full_name.asc${branchFilter}${EXCLUDE_DEMO_IDS}`, { headers: H() });
    const data = await res.json().catch(() => []);
    return NextResponse.json({ data: { people: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    console.error('[GET /api/church-center/people]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load directory' } }, { status: 500 });
  }
}
