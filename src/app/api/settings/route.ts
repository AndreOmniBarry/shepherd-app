import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` });

// Previously had no auth check at all — anyone with the URL, logged in or
// not, got the full church_settings key/value table. Gated the same way
// its sibling /api/settings/church-config already was.
export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const token = cookie.match(/shepherd_token=([^;]+)/)?.[1];
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/church_settings?select=key,value&order=key.asc`,
      { headers: hdrs() }
    );
    const data = await res.json();
    // Convert to key-value object
    const settings: Record<string, string> = {};
    if (Array.isArray(data)) {
      data.forEach((row: Record<string, string>) => { settings[row.key] = row.value; });
    }
    return NextResponse.json({ data: { settings }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load settings' } }, { status: 500 });
  }
}
