// Shared SLA grading — how fast something was actually resolved, not a
// predictive score. A = same day, B = within 3 days, C = within a week,
// D = within two weeks, F = longer or never acted on. Used anywhere a
// leader-facing portal has a turnaround-bound task: care team follow-ups,
// fellowship head approvals, accounts requisition decisions, etc.
export function computeSlaGrade(createdAt: string, resolvedAt: string): string {
  const hours = (new Date(resolvedAt).getTime() - new Date(createdAt).getTime()) / 36e5;
  if (hours <= 24) return 'A';
  if (hours <= 72) return 'B';
  if (hours <= 168) return 'C';
  if (hours <= 336) return 'D';
  return 'F';
}

// Turns any of the SLA letter grades used across the app (the A+..F- scale
// from same-day-of-week grading, or the plain A..F scale from computeSlaGrade
// above) into a 0-100 number so grades from different sources can be
// averaged and combined into a single composite score.
const GRADE_SCORES: Record<string, number> = {
  'A+': 100, 'A': 92, 'B': 80, 'C': 65, 'D': 45, 'F': 25, 'F-': 10,
};
export function gradeToScore(grade: string | null | undefined): number | null {
  if (!grade) return null;
  return GRADE_SCORES[grade] ?? null;
}
