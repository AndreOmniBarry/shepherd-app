export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { TERMS_VERSION } from '@/lib/terms-content';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export async function POST(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  // return=representation + a row check — TermsGate trusts `res.ok` alone
  // to dismiss the modal (see src/components/TermsGate.tsx), so this must
  // not report success unless a row was actually updated. With
  // return=minimal, a PATCH matching zero rows (a stale/invalid user id)
  // still comes back 200 with an empty body — indistinguishable from a
  // real update — which let the gate close while nothing was recorded.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
    method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=representation' },
    body: JSON.stringify({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }),
  });
  const data = await res.json().catch(() => []);
  const updated = Array.isArray(data) ? data[0] : data;
  if (!res.ok || !updated?.id) {
    console.error('[POST /api/auth/accept-terms] update failed', res.status, data);
    return NextResponse.json({ data: null, error: { message: 'Failed to record acceptance' } }, { status: 500 });
  }

  return NextResponse.json({ data: { accepted: true, version: TERMS_VERSION }, error: null });
}
