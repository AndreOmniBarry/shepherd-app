import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { computeSlaGrade } from '@/lib/care-assignment';

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
    const { status, notes, outcome } = body;

    // Reopening as 'new' resets the counter; any other update is another contact
    // attempt, so increment from whatever's currently stored rather than overwriting.
    let contact_attempts = 0;
    const currentRes = await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${params.id}&select=contact_attempts,created_at&limit=1`, { headers: hdrs() });
    const currentData = (await currentRes.json())?.[0];
    if (status !== 'new') {
      contact_attempts = (currentData?.contact_attempts || 0) + 1;
    }

    const update: Record<string, unknown> = {
      status, notes,
      last_contact: new Date().toISOString(),
      contact_attempts,
      updated_at: new Date().toISOString(),
    };

    // Closing requires a real outcome comment, and earns an SLA grade based
    // on actual time-to-resolution.
    if (status === 'closed' || status === 'restored') {
      const outcomeText = (outcome || notes)?.trim();
      if (!outcomeText) {
        return NextResponse.json({ data: null, error: { message: 'A comment is required to close this out' } }, { status: 400 });
      }
      update.outcome = outcomeText;
      if (currentData?.created_at) update.sla_grade = computeSlaGrade(currentData.created_at, new Date().toISOString());
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${params.id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify(update),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update lead' } }, { status: 500 });
  }
}
