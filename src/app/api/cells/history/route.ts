export const dynamic = 'force-dynamic';
import { getStructureHistory, CELL_HISTORY_CONFIG } from '@/lib/structure-history';

// Real attendance history for one cell, bucketed by week or month — no
// fabricated growth/noise. `offset` pages the window backward in time
// (offset=0 is the 12 most recent buckets, offset=1 the 12 before that),
// so the range can scale up (switch to month buckets) or move further
// back without needing a wall of preset "8w/3m/6m/1y" options.
//
// Auth/query/bucketing logic lives in src/lib/structure-history.ts, shared
// with /api/department/history and /api/fellowship/history — see that
// file's header comment for exactly what's shared vs. kept per-type.
export async function GET(req: Request) {
  return getStructureHistory(req, CELL_HISTORY_CONFIG);
}
