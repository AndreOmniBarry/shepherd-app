export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyToken, payloadToAuthUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function getUser(req: Request) {
  const m = req.headers.get('cookie')?.match(/shepherd_token=([^;]+)/);
  if (!m) return null;
  const p = await verifyToken(m[1]);
  return p ? payloadToAuthUser(p) : null;
}

// Merge two or more cells that should really be one (e.g. a fellowship
// that got split into multiple cells by mistake). Moves every member from
// the source cells into the target cell, then deactivates the source
// cells rather than deleting them — reversible if the merge turns out to
// be wrong, and keeps their historical attendance/meeting records intact
// under the (now inactive) cell they were originally logged against.
// Deliberately does NOT touch any cell_leader account's cell_id — if a
// merged-away cell had its own leader, that account still exists and its
// role should be reassigned separately by lead_tech.
// Fellowship heads can also do this, but only within their own
// fellowship — every source and target cell is checked against their
// fellowship_id before anything is touched.
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    const isAdmin = !!user && ['overseer', 'pa', 'lead_tech'].includes(user.role);
    const isFellowshipHead = !!user && user.role === 'fellowship_head' && !!user.fellowship_id;
    if (!user || !(isAdmin || isFellowshipHead)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const { source_cell_ids, target_cell_id } = await req.json();
    if (!Array.isArray(source_cell_ids) || source_cell_ids.length === 0 || !target_cell_id) {
      return NextResponse.json({ data: null, error: { message: 'source_cell_ids (array) and target_cell_id are required' } }, { status: 400 });
    }
    const sources: string[] = source_cell_ids.filter((id: string) => id !== target_cell_id);
    if (sources.length === 0) {
      return NextResponse.json({ data: null, error: { message: 'No source cells to merge — they must differ from the target' } }, { status: 400 });
    }

    const targetRes = await fetch(`${SURL}/rest/v1/cells?id=eq.${target_cell_id}&select=id,fellowship_id&limit=1`, { headers: H() });
    const targetData = await targetRes.json();
    const target = targetData?.[0];
    if (!target) return NextResponse.json({ data: null, error: { message: 'Target cell not found' } }, { status: 404 });

    if (isFellowshipHead) {
      if (target.fellowship_id !== user.fellowship_id) {
        return NextResponse.json({ data: null, error: { message: 'Target cell is not in your fellowship' } }, { status: 403 });
      }
      const sourcesRes = await fetch(`${SURL}/rest/v1/cells?id=in.(${sources.join(',')})&select=id,fellowship_id`, { headers: H() });
      const sourcesData = await sourcesRes.json();
      const allOwnFellowship = Array.isArray(sourcesData) && sourcesData.length === sources.length && sourcesData.every((c: { fellowship_id: string }) => c.fellowship_id === user.fellowship_id);
      if (!allOwnFellowship) {
        return NextResponse.json({ data: null, error: { message: 'One or more cells to merge are not in your fellowship' } }, { status: 403 });
      }
    }

    let movedMembers = 0;
    for (const sourceId of sources) {
      const countRes = await fetch(`${SURL}/rest/v1/members?cell_id=eq.${sourceId}&select=id`, { headers: H() });
      const countData = await countRes.json();
      movedMembers += Array.isArray(countData) ? countData.length : 0;

      await fetch(`${SURL}/rest/v1/members?cell_id=eq.${sourceId}`, {
        method: 'PATCH', headers: { ...H(), Prefer: 'return=minimal' },
        body: JSON.stringify({ cell_id: target_cell_id, fellowship_id: target.fellowship_id }),
      });
      await fetch(`${SURL}/rest/v1/cells?id=eq.${sourceId}`, {
        method: 'PATCH', headers: { ...H(), Prefer: 'return=minimal' },
        body: JSON.stringify({ is_active: false }),
      });
    }

    logAudit({ actor_id: user.id, actor_role: user.role, action: 'cell_merge', target_type: 'cell', target_id: target_cell_id, detail: { source_cell_ids: sources, moved_members: movedMembers } });

    return NextResponse.json({ data: { moved_members: movedMembers, merged_cells: sources.length }, error: null });
  } catch (err) {
    console.error('[POST /api/admin/cells/merge]', err);
    return NextResponse.json({ data: null, error: { message: 'Failed to merge cells' } }, { status: 500 });
  }
}
