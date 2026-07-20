export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` });

export async function GET() {
  try {
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
