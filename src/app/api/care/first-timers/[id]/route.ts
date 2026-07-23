import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
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
    const { status, notes, cell_id, completed_member_class, outcome } = body;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (cell_id !== undefined) update.cell_id = cell_id;
    if (completed_member_class !== undefined) update.completed_member_class = completed_member_class;

    // Closing with an outcome requires a real comment, and earns a real SLA
    // grade based on how fast it was actually resolved — not a predicted
    // conversion score.
    if (status === 'converted' || status === 'declined') {
      const outcomeText = (outcome || notes)?.trim();
      if (!outcomeText) {
        return NextResponse.json({ data: null, error: { message: 'A comment is required to close this out' } }, { status: 400 });
      }
      update.outcome = outcomeText;
      const recRes = await fetch(`${SUPABASE_URL}/rest/v1/first_timers?id=eq.${params.id}&select=created_at&limit=1`, { headers: hdrs() });
      const rec = (await recRes.json())?.[0];
      if (rec?.created_at) update.sla_grade = computeSlaGrade(rec.created_at, new Date().toISOString());
    }

    await fetch(`${SUPABASE_URL}/rest/v1/first_timers?id=eq.${params.id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(update),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update' } }, { status: 500 });
  }
}
