export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { TERMS_VERSION } from '@/lib/terms-content';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// Whether the signed-in user still needs to accept (or re-accept, if
// TERMS_VERSION moved on) the Terms of Use. The JWT itself never carries
// this — it's set at login and terms can be accepted mid-session — so this
// has to be a real query, not something read off the token.
export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ data: { authenticated: false, mustAccept: false }, error: null });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=terms_accepted_at,terms_version&limit=1`, { headers: hdrs() });
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;

  const mustAccept = !row?.terms_accepted_at || row?.terms_version !== TERMS_VERSION;
  // role travels with this response so TermsGate can render the right
  // portal-specific clauses (see getTermsSections) without a second call.
  return NextResponse.json({ data: { authenticated: true, mustAccept, currentVersion: TERMS_VERSION, role: user.role }, error: null });
}
