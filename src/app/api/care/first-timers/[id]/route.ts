import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { computeSlaGrade } from '@/lib/care-assignment';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/shepherd_token=([^;]+)/);
  const token = m?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return payloadToAuthUser(payload);
}

const ADMIN_ROLES = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    // This previously had no role check and no church guard at all — any
    // authenticated user could update any first_timer record, in any
    // church, by id. Now verified against the caller's own church, and
    // restricted to admins or the care team member it's actually assigned to.
    const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/first_timers?id=eq.${params.id}&church_id=eq.${user.church_id}&select=id,assigned_to,created_at&limit=1`, { headers: hdrs() });
    const existing = (await existingRes.json())?.[0];
    if (!existing) return NextResponse.json({ data: null, error: { message: 'First timer not found' } }, { status: 404 });
    if (!ADMIN_ROLES.includes(user.role) && existing.assigned_to !== user.id) {
      return NextResponse.json({ data: null, error: { message: 'Only the assigned care team member or an admin can update this' } }, { status: 403 });
    }

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
      if (existing.created_at) update.sla_grade = computeSlaGrade(existing.created_at, new Date().toISOString());
    }

    await fetch(`${SUPABASE_URL}/rest/v1/first_timers?id=eq.${params.id}&church_id=eq.${user.church_id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(update),
    });

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update' } }, { status: 500 });
  }
}
