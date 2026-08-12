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

  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
    method: 'PATCH', headers: { ...hdrs(), Prefer: 'return=minimal' },
    body: JSON.stringify({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }),
  });

  return NextResponse.json({ data: { accepted: true, version: TERMS_VERSION }, error: null });
}
