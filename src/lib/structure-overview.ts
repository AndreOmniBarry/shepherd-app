// ============================================================
// SHEP.HERD — Shared member-health overview calculations
// ============================================================
// Backs /api/cell/overview and /api/department/overview (which together
// feed the unified StructureOverview.tsx component from Phase 1). Both
// routes report "member-level attendance health within one unit" from
// their own type-specific tables (members/attendance_records/
// attendance_entries for cell; department_members/department_attendance/
// department_attendance_entries for department) — the fetch/shape logic
// and per-type action-message wording stay in each route file (they
// genuinely differ: department has no bestSunday/worstSunday/
// warningCount/upcomingBirthdays, and its action text is worded
// differently), but the pure calculations below were copy-pasted
// verbatim between the two files and are shared here instead.
//
// Fellowship is deliberately NOT part of this module — same reasoning as
// StructureOverview.tsx's own header comment: fellowship's overview is a
// cross-cell rollup, not a member-health table, so nothing here applies.

export type Health = 'healthy' | 'fair' | 'low' | 'watch' | 'warning' | 'critical' | 'new';

export function computeHealth(consecutiveAbsences: number, rate: number | null): Health {
  if (consecutiveAbsences >= 3) return 'critical';
  if (consecutiveAbsences >= 2) return 'warning';
  if (consecutiveAbsences >= 1) return 'watch';
  if (rate !== null && rate >= 80) return 'healthy';
  if (rate !== null && rate >= 60) return 'fair';
  if (rate !== null) return 'low';
  return 'new';
}

// Cell's endpoint also reports a "recently" status (birthday within the
// last 3 days); department's does not. Preserved as an explicit opt-in
// rather than silently applied to both.
export function computeBirthdayStatus(dateOfBirth: string | null | undefined, opts: { includeRecently?: boolean } = {}): string | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const bday = new Date(dateOfBirth);
  const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  const daysUntil = Math.ceil((thisYearBday.getTime() - today.getTime()) / 86400000);
  if (daysUntil === 0) return 'today';
  if (daysUntil > 0 && daysUntil <= 7) return `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
  if (opts.includeRecently && daysUntil < 0 && daysUntil >= -3) return 'recently';
  return null;
}

export type TrendPoint = { week: string; present: number; absent: number; rate: number; sla: string; date: string };

type AttendanceRecordLike = { present_count: unknown; absent_count: unknown; sla_grade: unknown; services: unknown };

export function buildTrend(records: AttendanceRecordLike[]): TrendPoint[] {
  return Array.isArray(records) ? records.slice(0, 8).reverse().map((r, i) => ({
    week: `W${i + 1}`,
    present: r.present_count as number,
    absent: r.absent_count as number,
    rate: Math.round(((r.present_count as number) / Math.max(1, (r.present_count as number) + (r.absent_count as number))) * 100),
    sla: r.sla_grade as string,
    date: (r.services as Record<string, string> | null)?.service_date as string,
  })) : [];
}

export function buildSlaHistory(records: AttendanceRecordLike[]): { date: string; grade: string }[] {
  return Array.isArray(records) ? records.slice(0, 8).map(r => ({
    date: (r.services as Record<string, string> | null)?.service_date as string,
    grade: r.sla_grade as string,
  })) : [];
}

export function computeAvgRate(trend: { rate: number }[]): number | null {
  return trend.length > 0 ? Math.round(trend.reduce((a, t) => a + t.rate, 0) / trend.length) : null;
}
