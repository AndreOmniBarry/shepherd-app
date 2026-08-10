export const dynamic = 'force-dynamic';
import { getStructureHistory, FELLOWSHIP_HISTORY_CONFIG } from '@/lib/structure-history';

// Same real, bucketed pattern as /api/cells/history, aggregated across every
// cell in the caller's own fellowship instead of a single cell.
//
// Auth/query/bucketing logic lives in src/lib/structure-history.ts, shared
// with /api/cells/history and /api/department/history — see that file's
// header comment for exactly what's shared vs. kept per-type (fellowship's
// admin role list and branch-scoping behavior genuinely differ from the
// other two and are preserved as-is, not equalized).
export async function GET(req: Request) {
  return getStructureHistory(req, FELLOWSHIP_HISTORY_CONFIG);
}
