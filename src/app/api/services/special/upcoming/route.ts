export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Leader-facing view of special service days (vigils, conventions, crusades)
// within the 14-day submission window — this is what actually makes them
// discoverable to a cell/department leader, who otherwise has no way to
// know a special day was added at all except being told verbally. Also
// flags whether THIS leader has already submitted for it, so it reads as
// a to-do list, not just a list of dates.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    if (!['cell_leader', 'department_head', 'fellowship_head'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const svcRes = await fetch(`${SURL}/rest/v1/services?service_type=eq.special&service_date=gte.${cutoff}&service_date=lte.${today}&church_id=eq.${user.church_id}&order=service_date.desc&select=id,service_date,notes`, { headers: H() });
    const services = await svcRes.json();
    const rows: { id: string; service_date: string; notes: string | null }[] = Array.isArray(services) ? services : [];
    if (rows.length === 0) return NextResponse.json({ data: { special_services: [] }, error: null });

    const ids = rows.map(s => s.id);
    let submittedIds = new Set<string>();
    if (user.role === 'cell_leader' && user.cell_id) {
      const res = await fetch(`${SURL}/rest/v1/attendance_records?service_id=in.(${ids.join(',')})&cell_id=eq.${user.cell_id}&select=service_id`, { headers: H() });
      const data = await res.json();
      submittedIds = new Set((Array.isArray(data) ? data : []).map((r: { service_id: string }) => r.service_id));
    } else if (user.role === 'department_head') {
      const deptRes = await fetch(`${SURL}/rest/v1/users?id=eq.${user.id}&select=department_id&limit=1`, { headers: H() });
      const deptData = await deptRes.json();
      const departmentId = deptData?.[0]?.department_id;
      if (departmentId) {
        const res = await fetch(`${SURL}/rest/v1/department_attendance?service_id=in.(${ids.join(',')})&department_id=eq.${departmentId}&select=service_id`, { headers: H() });
        const data = await res.json();
        submittedIds = new Set((Array.isArray(data) ? data : []).map((r: { service_id: string }) => r.service_id));
      }
    }

    const special_services = rows.map(s => ({
      id: s.id, service_date: s.service_date, label: s.notes || 'Special service',
      submitted: submittedIds.has(s.id),
    }));

    return NextResponse.json({ data: { special_services }, error: null });
  } catch (err) {
    console.error('[GET /api/services/special/upcoming]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load special service days' } }, { status: 500 });
  }
}
