import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdrs = () => ({ 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/shepherd_token=([^;]+)/);
    const token = m?.[1];
    if (!token) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    const user = payloadToAuthUser(payload);
    if (!['overseer', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    // Use Lagos time UTC+1 for today's date to avoid cutoff issues
    const lagosToday = new Date(Date.now() + 60 * 60 * 1000).toISOString().split('T')[0];
    const weeks = parseInt(searchParams.get('weeks') || '8');
    const lagosNowMs = Date.now() + 60 * 60 * 1000;
    const cutoff = new Date(lagosNowMs - weeks * 7 * 24 * 60 * 60 * 1000);

    // ── 1. Recent Sunday services ──────────────────────────────
    const sundayServicesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_type=neq.midweek&service_date=gte.${cutoff.toISOString().split('T')[0]}&service_date=lte.${lagosToday}&order=service_date.desc&limit=${weeks}&select=id,service_date,service_type,service_number`,
      { headers: hdrs() }
    );
    const sundayServices = await sundayServicesRes.json();

    // ── 2. Recent Midweek services ─────────────────────────────
    const midweekServicesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/services?service_type=eq.midweek&service_date=gte.${cutoff.toISOString().split('T')[0]}&service_date=lte.${lagosToday}&order=service_date.desc&limit=${weeks}&select=id,service_date,service_type`,
      { headers: hdrs() }
    );
    const midweekServices = await midweekServicesRes.json();

    // ── 3. Cell attendance records ─────────────────────────────
    const cellAttRes = await fetch(
      `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=500&select=id,present_count,absent_count,visitor_count,submitted_at,sla_grade,service_id,cell_id,cells(name,fellowship_id,fellowships(name))`,
      { headers: hdrs() }
    );
    const cellRecords = await cellAttRes.json();

    // ── 4. Department attendance records ──────────────────────
    const deptAttRes = await fetch(
      `${SUPABASE_URL}/rest/v1/department_attendance?submitted_at=gte.${cutoff.toISOString()}&order=submitted_at.desc&limit=200&select=id,present_count,absent_count,submitted_at,sla_grade,service_id,department_id,departments(name)`,
      { headers: hdrs() }
    );
    const deptRecords = await deptAttRes.json();

    // ── 5. All cells and fellowships ──────────────────────────
    const cellsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cells?select=id,name,fellowship_id,fellowships(id,name)&order=name.asc`,
      { headers: hdrs() }
    );
    const allCells = await cellsRes.json();

    const fellowshipsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/fellowships?select=id,name&order=name.asc`,
      { headers: hdrs() }
    );
    const fellowships = await fellowshipsRes.json();

    const deptsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/departments?select=id,name&order=name.asc`,
      { headers: hdrs() }
    );
    const departments = await deptsRes.json();

    // ── 6. Latest Sunday — submission status per cell ──────────
    const latestSunday = Array.isArray(sundayServices) ? sundayServices[0] : null;
    const latestMidweek = Array.isArray(midweekServices) ? midweekServices[0] : null;

    const cellSubmissionStatus = Array.isArray(allCells) ? allCells.map((cell: Record<string, unknown>) => {
      const fellowship = cell.fellowships as Record<string, string> | null;
      const submitted = Array.isArray(cellRecords) ? cellRecords.find((r: Record<string, string>) =>
        r.cell_id === cell.id && r.service_id === latestSunday?.id
      ) : null;
      const midweekSubmitted = Array.isArray(cellRecords) ? cellRecords.find((r: Record<string, string>) =>
        r.cell_id === cell.id && r.service_id === latestMidweek?.id
      ) : null;
      return {
        cell_id: cell.id,
        cell_name: cell.name,
        fellowship_name: fellowship?.name || '—',
        sunday_submitted: !!submitted,
        sunday_present: submitted?.present_count || 0,
        sunday_absent: submitted?.absent_count || 0,
        sunday_sla: submitted?.sla_grade || null,
        midweek_submitted: !!midweekSubmitted,
        midweek_present: midweekSubmitted?.present_count || 0,
        midweek_sla: midweekSubmitted?.sla_grade || null,
      };
    }) : [];

    // ── 7. Sunday trend (requested range — sundayServices is already bounded by `weeks`) ──
    const sundayTrend = Array.isArray(sundayServices) ? [...sundayServices].reverse().map((svc: Record<string, string>, i: number) => {
      const records = Array.isArray(cellRecords) ? cellRecords.filter((r: Record<string, string>) => r.service_id === svc.id) : [];
      const present = records.reduce((a: number, r: Record<string, number>) => a + (r.present_count || 0), 0);
      const absent = records.reduce((a: number, r: Record<string, number>) => a + (r.absent_count || 0), 0);
      const total = present + absent;
      return {
        week: `W${i + 1}`,
        date: svc.service_date,
        present,
        absent,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
        cells_submitted: records.length,
      };
    }) : [];

    // ── 8. Midweek trend (requested range) ─────────────────────
    const midweekTrend = Array.isArray(midweekServices) ? [...midweekServices].reverse().map((svc: Record<string, string>, i: number) => {
      const records = Array.isArray(cellRecords) ? cellRecords.filter((r: Record<string, string>) => r.service_id === svc.id) : [];
      const present = records.reduce((a: number, r: Record<string, number>) => a + (r.present_count || 0), 0);
      const absent = records.reduce((a: number, r: Record<string, number>) => a + (r.absent_count || 0), 0);
      const total = present + absent;
      return {
        week: `W${i + 1}`,
        date: svc.service_date,
        present,
        absent,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
        cells_submitted: records.length,
      };
    }) : [];

    // ── 9. Department submission status ────────────────────────
    const deptStatus = Array.isArray(departments) ? departments.map((dept: Record<string, string>) => {
      const submitted = Array.isArray(deptRecords) ? deptRecords.find((r: Record<string, string>) =>
        r.department_id === dept.id && r.service_id === latestSunday?.id
      ) : null;
      return {
        dept_id: dept.id,
        dept_name: dept.name,
        submitted: !!submitted,
        present: submitted?.present_count || 0,
        absent: submitted?.absent_count || 0,
        sla: submitted?.sla_grade || null,
      };
    }) : [];

    // ── 10. Fellowship summary ─────────────────────────────────
    const buildFelSummary = (svcId: string | undefined) =>
      Array.isArray(fellowships) ? fellowships.map((fel: Record<string, string>) => {
        const felCells = Array.isArray(allCells) ? allCells.filter((c: Record<string, unknown>) => {
          const felObj = c.fellowships as Record<string, string> | null;
          return felObj?.id === fel.id || c.fellowship_id === fel.id;
        }) : [];
        const submitted = felCells.filter((c: Record<string, string>) =>
          Array.isArray(cellRecords) && cellRecords.some((r: Record<string, string>) =>
            r.cell_id === c.id && r.service_id === svcId
          )
        );
        const totalPresent = submitted.reduce((a: number, c: Record<string, string>) => {
          const rec = Array.isArray(cellRecords) && cellRecords.find((r: Record<string, string>) =>
            r.cell_id === c.id && r.service_id === svcId
          );
          return a + ((rec as Record<string, number>)?.present_count || 0);
        }, 0);
        return {
          fellowship_id: fel.id,
          fellowship_name: fel.name,
          total_cells: felCells.length,
          submitted_cells: submitted.length,
          total_present: totalPresent,
          completion_rate: felCells.length > 0 ? Math.round((submitted.length / felCells.length) * 100) : 0,
        };
      }) : [];
    const fellowshipSummary = buildFelSummary(latestSunday?.id);
    const fellowshipSummaryMidweek = buildFelSummary(latestMidweek?.id);
    return NextResponse.json({
      data: {
        latest_sunday: latestSunday,
        latest_midweek: latestMidweek,
        sunday_trend: sundayTrend,
        midweek_trend: midweekTrend,
        cell_submission_status: cellSubmissionStatus,
        dept_status: deptStatus,
        fellowship_summary: fellowshipSummary,
        fellowship_summary_midweek: fellowshipSummaryMidweek,
        total_cells: Array.isArray(allCells) ? allCells.length : 0,
        cells_submitted_sunday: cellSubmissionStatus.filter(c => c.sunday_submitted).length,
        cells_submitted_midweek: cellSubmissionStatus.filter(c => c.midweek_submitted).length,
      },
      error: null,
    });
  } catch (err) {
    console.error('[GET /api/analytics/attendance]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to load attendance data' } }, { status: 500 });
  }
}
