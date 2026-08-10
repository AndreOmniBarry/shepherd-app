export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { resolveBranchScope } from '@/lib/branch-scope';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}` });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

type Flag = { severity: 'high' | 'medium'; category: string; entity: string; message: string; link: string };

// Health-checker for the whole church — every rule here is a generic
// statistical comparison (this entity vs its own trailing history), never
// a hardcoded name or threshold tied to one specific cell/department. No
// human has to notice a decline for it to get flagged.
export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user || !['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'].includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const { branchId, forbidden } = resolveBranchScope(user, searchParams);
    if (forbidden) {
      return NextResponse.json({ data: null, error: { message: 'No branch assigned to this account' } }, { status: 403 });
    }

    const flags: Flag[] = [];
    const WEEKS = 8;
    const windowStart = new Date(Date.now() - WEEKS * 7 * 86400000);

    // ── Cell attendance trend ────────────────────────────────
    const churchFilter = `&church_id=eq.${user.church_id}`;
    const cellFilter = branchId ? `&branch_id=eq.${branchId}` : '';
    const cellsRes = await fetch(`${S}/rest/v1/cells?select=id,name${cellFilter}${churchFilter}`, { headers: H() });
    const cells: { id: string; name: string }[] = await cellsRes.json().catch(() => []);
    if (Array.isArray(cells) && cells.length > 0) {
      const cellIds = cells.map(c => c.id);
      const recRes = await fetch(`${S}/rest/v1/attendance_records?cell_id=in.(${cellIds.join(',')})&services.service_date=gte.${windowStart.toISOString().split('T')[0]}&select=cell_id,present_count,absent_count,services(service_date)`, { headers: H() });
      const records: { cell_id: string; present_count: number; absent_count: number; services: { service_date: string } | null }[] = await recRes.json().catch(() => []);
      for (const cell of cells) {
        const rows = (Array.isArray(records) ? records : []).filter(r => r.cell_id === cell.id && r.services?.service_date);
        const buckets: { rate: number; date: string }[] = [];
        for (let i = 0; i < WEEKS; i++) {
          const bStart = new Date(windowStart.getTime() + i * 7 * 86400000);
          const bEnd = new Date(bStart.getTime() + 7 * 86400000);
          const inBucket = rows.filter(r => { const d = new Date(r.services!.service_date); return d >= bStart && d < bEnd; });
          const present = inBucket.reduce((s, r) => s + (r.present_count || 0), 0);
          const absent = inBucket.reduce((s, r) => s + (r.absent_count || 0), 0);
          const total = present + absent;
          buckets.push({ rate: total > 0 ? (present / total) * 100 : -1, date: bEnd.toISOString().split('T')[0] });
        }
        const last2 = buckets.slice(-2);
        const earlier = buckets.slice(0, -2).filter(b => b.rate >= 0);
        if (last2.every(b => b.rate === -1) && earlier.length > 0) {
          flags.push({ severity: 'medium', category: 'attendance', entity: cell.name, message: `${cell.name} hasn't submitted attendance in the last 2 weeks`, link: '/dashboard?page=cells' });
        } else if (earlier.length >= 3) {
          const trailingAvg = earlier.reduce((s, b) => s + b.rate, 0) / earlier.length;
          const recentAvg = last2.filter(b => b.rate >= 0).reduce((s, b) => s + b.rate, 0) / (last2.filter(b => b.rate >= 0).length || 1);
          if (trailingAvg > 0 && recentAvg < trailingAvg * 0.8) {
            flags.push({ severity: 'high', category: 'attendance', entity: cell.name, message: `${cell.name}'s attendance dropped ${Math.round((1 - recentAvg / trailingAvg) * 100)}% vs its own trailing average (${Math.round(recentAvg)}% vs ${Math.round(trailingAvg)}%)`, link: '/dashboard?page=cells' });
          }
        }
      }
    }

    // ── Care backlog ────────────────────────────────
    const careCutoff = new Date(Date.now() - 14 * 86400000).toISOString();
    const branchQ = branchId ? `&branch_id=eq.${branchId}` : '';
    const [timersRes, leadsRes] = await Promise.all([
      fetch(`${S}/rest/v1/first_timers?status=neq.converted&status=neq.declined&created_at=lt.${careCutoff}&select=id${branchQ}${churchFilter}`, { headers: H() }),
      fetch(`${S}/rest/v1/care_leads?status=neq.restored&status=neq.unreachable&status=neq.closed&created_at=lt.${careCutoff}&select=id${branchQ}${churchFilter}`, { headers: H() }),
    ]);
    const openTimers = await timersRes.json().catch(() => []);
    const openLeads = await leadsRes.json().catch(() => []);
    const backlogCount = (Array.isArray(openTimers) ? openTimers.length : 0) + (Array.isArray(openLeads) ? openLeads.length : 0);
    if (backlogCount > 0) {
      flags.push({ severity: backlogCount >= 5 ? 'high' : 'medium', category: 'care', entity: 'Care & Follow-up', message: `${backlogCount} first-timer${backlogCount !== 1 ? 's' : ''}/care lead${backlogCount !== 1 ? 's' : ''} still open after 2+ weeks`, link: '/dashboard?page=care_followup' });
    }

    // ── Workforce gaps ────────────────────────────────
    const deptRes = await fetch(`${S}/rest/v1/departments?select=id,name${branchQ}${churchFilter}`, { headers: H() });
    const depts: { id: string; name: string }[] = await deptRes.json().catch(() => []);
    if (Array.isArray(depts) && depts.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const deptIdFilter = `(${depts.map(d => d.id).join(',')})`;
      const rosterRes = await fetch(`${S}/rest/v1/workforce_rosters?department_id=in.${deptIdFilter}&service_date=gte.${today}&select=department_id,service_date,workforce_roster_entries(id)`, { headers: H() });
      const rosters: { department_id: string; workforce_roster_entries: unknown[] }[] = await rosterRes.json().catch(() => []);
      for (const dept of depts) {
        const hasCoverage = (Array.isArray(rosters) ? rosters : []).some(r => r.department_id === dept.id && (r.workforce_roster_entries?.length || 0) > 0);
        if (!hasCoverage) {
          flags.push({ severity: 'medium', category: 'workforce', entity: dept.name, message: `${dept.name} has no roster set for the next service`, link: '/dashboard?page=workforce' });
        }
      }
    }

    // ── Requisition backlog ────────────────────────────────
    const reqCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    const reqRes = await fetch(`${S}/rest/v1/expense_requisitions?status=eq.pending&created_at=lt.${reqCutoff}&select=id,title${branchQ}${churchFilter}`, { headers: H() });
    const pendingReqs: { id: string; title: string }[] = await reqRes.json().catch(() => []);
    if (Array.isArray(pendingReqs) && pendingReqs.length > 0) {
      flags.push({ severity: pendingReqs.length >= 3 ? 'high' : 'medium', category: 'requisitions', entity: 'Requisitions', message: `${pendingReqs.length} requisition${pendingReqs.length !== 1 ? 's' : ''} pending approval for over a week`, link: '/dashboard?page=requisitions' });
    }

    flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
    return NextResponse.json({ data: { flags, generated_at: new Date().toISOString() }, error: null });
  } catch (err) {
    console.error('[GET /api/analytics/action-board]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to compute action board' } }, { status: 500 });
  }
}
