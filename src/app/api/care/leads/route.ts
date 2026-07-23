import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

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

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

    const isAdmin = ['overseer', 'pa', 'lead_tech'].includes(user.role);
    const scope = isAdmin ? '' : `&assigned_to=eq.${user.id}`;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/care_leads?order=created_at.desc&limit=100&select=id,member_id,weeks_absent,status,contact_attempts,last_contact,notes,outcome,sla_grade,assigned_to,created_at,members(full_name,phone,cells(name),fellowships(name))${scope}`,
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
