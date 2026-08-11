export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  return getAuthUser(req);
}

// Who a person can request a meeting with — every other active account in
// their own branch (general_overseer/lead_tech see everyone within their
// own church, since they aren't tied to one branch — but never another
// church's people, regardless of role).
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    // A branch_pastor with no branch_id assigned yet must see nobody, not
    // fall through to the whole church's directory (the branchFilter below
    // would otherwise evaluate to '' for them, same as the intentional
    // "no branch_id" case for general_overseer/lead_tech). Every other
    // role's behavior below is unchanged.
    if (user.role === 'branch_pastor' && !user.branch_id) {
      return NextResponse.json({ data: { people: [] }, error: null });
    }

    const branchFilter = user.branch_id && !['general_overseer', 'lead_tech'].includes(user.role) ? `&branch_id=eq.${user.branch_id}` : '';
    const churchFilter = user.church_id ? `&church_id=eq.${user.church_id}` : '';
    const res = await fetch(`${SURL}/rest/v1/users?is_active=eq.true&id=neq.${user.id}&select=id,full_name,role&order=full_name.asc${branchFilter}${churchFilter}${EXCLUDE_DEMO_IDS}`, { headers: H() });
    const data = await res.json().catch(() => []);
    return NextResponse.json({ data: { people: Array.isArray(data) ? data : [] }, error: null });
  } catch (err) {
    console.error('[GET /api/church-center/people]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load directory' } }, { status: 500 });
  }
}
