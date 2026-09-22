import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { computeSlaGrade } from '@/lib/care-assignment';
import { resolveBranchScope } from '@/lib/branch-scope';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    // No role check here at all let ANY authenticated user in the church —
    // a cell_leader, a department_head, anyone — update or close out
    // another user's care lead just by knowing/guessing its id, matching
    // the GET route's own admin-or-assigned-to-self scoping.
    const isAdmin = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role);
    if (!isAdmin && user.role !== 'care_team') {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 403 });
    }
    // branch_pastor is locked to their own branch everywhere else this
    // resource is read (GET /api/care/leads) — match that here too.
    const { branchId, forbidden } = resolveBranchScope(user, null);
    if (forbidden) return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });

    const body = await req.json();
    const { status, notes, outcome } = body;

    // Reopening as 'new' resets the counter; any other update is another contact
    // attempt, so increment from whatever's currently stored rather than overwriting.
    let contact_attempts = 0;
    const currentRes = await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${params.id}&church_id=eq.${user.church_id}&select=contact_attempts,created_at,assigned_to,branch_id&limit=1`, { headers: hdrs() });
    const currentData = (await currentRes.json())?.[0];
    if (!currentData) return NextResponse.json({ data: null, error: { message: 'Lead not found' } }, { status: 404 });
    if (!isAdmin && currentData.assigned_to !== user.id) {
      return NextResponse.json({ data: null, error: { message: 'You can only update leads assigned to you' } }, { status: 403 });
    }
    if (branchId && currentData.branch_id !== branchId) {
      return NextResponse.json({ data: null, error: { message: 'Lead not found' } }, { status: 404 });
    }
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

    const res = await fetch(`${SUPABASE_URL}/rest/v1/care_leads?id=eq.${params.id}&church_id=eq.${user.church_id}`, {
      method: 'PATCH',
      headers: { ...hdrs(), 'Prefer': 'return=representation' },
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('care_leads update failed:', errBody);
      return NextResponse.json({ data: null, error: { message: 'Failed to update lead' } }, { status: 500 });
    }

    return NextResponse.json({ data: { updated: true }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to update lead' } }, { status: 500 });
  }
}
