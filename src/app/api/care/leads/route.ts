import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { resolveBranchScope } from '@/lib/branch-scope';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  return getAuthUser(req);
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const isAdmin = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role);
    const scope = isAdmin ? '' : `&assigned_to=eq.${user.id}`;
    const { searchParams } = new URL(req.url);
    const { branchFilter, forbidden } = resolveBranchScope(user, searchParams);
    if (forbidden) {
      return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
    }
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/care_leads?order=created_at.desc&limit=100&select=id,member_id,weeks_absent,status,contact_attempts,last_contact,notes,outcome,sla_grade,assigned_to,created_at,members(full_name,phone,cells(name),fellowships(name))&church_id=eq.${user.church_id}${scope}${branchFilter}`,
      { headers: hdrs() }
    );
    const data = await res.json();
    const leads = (Array.isArray(data) ? data : []).map((l: Record<string, unknown>) => {
      const mem = l.members as Record<string, unknown> | null;
      const cell = mem?.cells as Record<string, string> | null;
      const fel = mem?.fellowships as Record<string, string> | null;
      return {
        id: l.id,
        member_name: mem?.full_name || '—',
        member_phone: mem?.phone || '—',
        cell_name: cell?.name || '—',
        fellowship: fel?.name || '—',
        weeks_absent: l.weeks_absent || 0,
        trigger_date: l.created_at,
        assigned_to: l.assigned_to,
        status: l.status || 'new',
        contact_attempts: l.contact_attempts || 0,
        last_contact: l.last_contact,
        notes: l.notes,
        outcome: l.outcome,
        sla_grade: l.sla_grade,
      };
    });

    return NextResponse.json({ data: { leads }, error: null });
  } catch (err) {
    return NextResponse.json({ data: null, error: { message: 'Failed to load leads' } }, { status: 500 });
  }
}
