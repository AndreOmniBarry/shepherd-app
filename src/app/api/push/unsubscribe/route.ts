import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

// Scoped to the caller's own user_id as well as the endpoint, so one
// account can never delete another's subscription row by guessing/
// replaying an endpoint value.
export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json().catch(() => null);
    const endpoint: string | undefined = body?.endpoint;
    if (!endpoint) return NextResponse.json({ data: null, error: { message: 'Missing endpoint' } }, { status: 400 });

    await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_id=eq.${user.id}`,
      { method: 'DELETE', headers: hdrs() }
    );
    return NextResponse.json({ data: { ok: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Failed to remove subscription' } }, { status: 500 });
  }
}
