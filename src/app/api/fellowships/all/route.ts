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

// Plain fellowship id/name list, used to populate the "Create Cell" dropdown.
// Was previously fetched client-side straight from Supabase with the public
// anon key — moved server-side so it goes through normal login auth instead
// of relying on the fellowships table being openly readable.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const { branchFilter, forbidden } = resolveBranchScope(user, searchParams);
  if (forbidden) {
    return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/fellowships?select=id,name&order=name.asc${branchFilter}&church_id=eq.${user.church_id}`, { headers: hdrs() });
  const data = await res.json();
  return NextResponse.json({ data: { fellowships: Array.isArray(data) ? data : [] }, error: null });
}
