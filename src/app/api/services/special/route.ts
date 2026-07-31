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

// Special service days (vigils, conventions, congress days) live in the
// same `services` table as regular Sunday/midweek services, but they're
// one-off and shouldn't get silently averaged into the regular attendance
// trend charts. This is the one place their real attendance — from both
// cells and departments — is actually visible on its own.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const svcRes = await fetch(`${SURL}/rest/v1/services?service_type=eq.special&order=service_date.desc&limit=25&select=id,service_date,notes,created_at`, { headers: H() });
    const services = await svcRes.json();
    const rows = Array.isArray(services) ? services : [];
    if (rows.length === 0) return NextResponse.json({ data: { special_services: [] }, error: null });

    const ids = rows.map((s: { id: string }) => s.id);
    const [cellRes, deptRes] = await Promise.all([
      fetch(`${SURL}/rest/v1/attendance_records?service_id=in.(${ids.join(',')})&select=service_id,present_count,absent_count,visitor_count,cell_id`, { headers: H() }),
      fetch(`${SURL}/rest/v1/department_attendance?service_id=in.(${ids.join(',')})&select=service_id,present_count,absent_count,department_id`, { headers: H() }),
    ]);
    const cellRecords = await cellRes.json();
    const deptRecords = await deptRes.json();

    const special_services = rows.map((s: { id: string; service_date: string; notes: string | null; created_at: string }) => {
      const cells = (Array.isArray(cellRecords) ? cellRecords : []).filter((r: { service_id: string }) => r.service_id === s.id);
      const depts = (Array.isArray(deptRecords) ? deptRecords : []).filter((r: { service_id: string }) => r.service_id === s.id);
      const cellPresent = cells.reduce((a: number, r: { present_count: number }) => a + (r.present_count || 0), 0);
      const cellAbsent = cells.reduce((a: number, r: { absent_count: number }) => a + (r.absent_count || 0), 0);
      const visitors = cells.reduce((a: number, r: { visitor_count?: number }) => a + (r.visitor_count || 0), 0);
      const deptPresent = depts.reduce((a: number, r: { present_count: number }) => a + (r.present_count || 0), 0);
      const deptAbsent = depts.reduce((a: number, r: { absent_count: number }) => a + (r.absent_count || 0), 0);
      return {
        id: s.id,
        service_date: s.service_date,
        label: s.notes || 'Special service',
        cells_reported: new Set(cells.map((r: { cell_id: string }) => r.cell_id)).size,
        depts_reported: new Set(depts.map((r: { department_id: string }) => r.department_id)).size,
        cell_present: cellPresent,
        cell_absent: cellAbsent,
        visitors,
        dept_present: deptPresent,
        dept_absent: deptAbsent,
      };
    });

    return NextResponse.json({ data: { special_services }, error: null });
  } catch (err) {
    console.error('[GET /api/services/special]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load special services' } }, { status: 500 });
  }
}
