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
