import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { status, notes } = body;

    // Reopening as 'new' resets the counter; any other update is another contact
    // attempt, so increment from whatever's currently stored rather than overwriting.
    let contact_attempts = 0;
    if (status !== 'new') {
      const currentRes = await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${params.id}&select=contact_attempts&limit=1`, { headers: hdrs() });
      const currentData = await currentRes.json();
      contact_attempts = (currentData?.[0]?.contact_attempts || 0) + 1;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${params.id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify({
        status,
        notes,
        last_contact: new Date().toISOString(),
        contact_attempts,
        updated_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update lead' } }, { status: 500 });
  }
}
