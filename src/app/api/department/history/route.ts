export const dynamic = 'force-dynamic';
import { getStructureHistory, DEPARTMENT_HISTORY_CONFIG } from '@/lib/structure-history';

// Real attendance history for one department, bucketed by week or month —
// same contract as /api/cells/history so both plug into the same
// AttendanceHistoryPanel component.
//
// Auth/query/bucketing logic lives in src/lib/structure-history.ts, shared
// with /api/cells/history and /api/fellowship/history — see that file's
// header comment for exactly what's shared vs. kept per-type.
export async function GET(req: Request) {
  return getStructureHistory(req, DEPARTMENT_HISTORY_CONFIG);
}
