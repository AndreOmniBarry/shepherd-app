// Shared SLA grading — how fast something was actually resolved, not a
// predictive score. Granular A+..D- scale in half-day-ish steps for the
// first two days, then widening bands as turnaround stretches out: A+ =
// within 12h, A = same day, A-/B+ = within 1-2 days, down through the
// C and D tiers, F = longer than ~17 days or never acted on. Used
// anywhere a leader-facing portal has a turnaround-bound task: care team
// follow-ups, fellowship head approvals, accounts requisition decisions,
// etc.
//
// Historical rows computed under the old flat A/B/C/D/F scale are left
// as-is (never backfilled) — GRADE_SCORES below covers both scales so old
// and new grades can be averaged together without distinction.
export function computeSlaGrade(createdAt: string, resolvedAt: string): string {
  const hours = (new Date(resolvedAt).getTime() - new Date(createdAt).getTime()) / 36e5;
  if (hours <= 12) return 'A+';
  if (hours <= 24) return 'A';
  if (hours <= 36) return 'A-';
  if (hours <= 48) return 'B+';
  if (hours <= 72) return 'B';
  if (hours <= 96) return 'B-';
  if (hours <= 120) return 'C+';
  if (hours <= 168) return 'C';
  if (hours <= 216) return 'C-';
  if (hours <= 264) return 'D+';
  if (hours <= 336) return 'D';
  if (hours <= 408) return 'D-';
  return 'F';
}

// Turns any of the SLA letter grades used across the app (the A+..F- scale
// from same-day-of-week grading, the plain A..F scale computeSlaGrade used
// historically, or the granular A+..D- scale computeSlaGrade produces now)
// into a 0-100 number so grades from different sources — and different
// eras of the same source — can be averaged and combined into a single
// composite score.
const GRADE_SCORES: Record<string, number> = {
  'A+': 100, 'A': 92, 'A-': 86,
  'B+': 83, 'B': 80, 'B-': 74,
  'C+': 70, 'C': 65, 'C-': 58,
  'D+': 52, 'D': 45, 'D-': 38,
  'F': 25, 'F-': 10,
};
export function gradeToScore(grade: string | null | undefined): number | null {
  if (!grade) return null;
  return GRADE_SCORES[grade] ?? null;
}

// Shared badge coloring for any SLA/grade letter used across the app — the
// same bg/text pairs the fellowship, cell, department, and structure
// overview screens used to each hand-roll independently (A-tier green,
// B-tier purple, C-tier amber, D-tier orange, F red — one hue per letter
// tier), now with +/- rendered as a lighter/darker shade of that same hue
// instead of a different color: "+" is the most saturated shade of its
// tier, the flat letter is the original mid shade, "-" is the lightest —
// so within a tier you can see who's trending toward the tier above or
// below without the color itself changing. F has no "+"/"-" of its own
// (computeSlaGrade never produces one); F- is the separate, darker,
// already-established "critical/overdue" shade from the day-of-week
// grading scale (see cydf-headcount's calcSLA) and keeps its own color.
// Falls back to the flat letter's color for any unrecognized grade string
// so a badge never renders unstyled.
const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  'A+': { bg: '#CFF0E2', text: '#06402F' },
  'A':  { bg: '#E1F5EE', text: '#085041' },
  'A-': { bg: '#E9F7F1', text: '#0F6650' },
  'B+': { bg: '#E3E1FC', text: '#322B7A' },
  'B':  { bg: '#EEEDFE', text: '#3C3489' },
  'B-': { bg: '#F2F1FE', text: '#4A419C' },
  'C+': { bg: '#F7E7C9', text: '#52300A' },
  'C':  { bg: '#FAEEDA', text: '#633806' },
  'C-': { bg: '#FCF3E6', text: '#7A4A15' },
  'D+': { bg: '#F6E0D8', text: '#7A2E14' },
  'D':  { bg: '#FAECE7', text: '#993C1D' },
  'D-': { bg: '#FCF1EE', text: '#B0542E' },
  'F':  { bg: '#FCEBEB', text: '#A32D2D' },
  'F-': { bg: '#FCEBEB', text: '#A32D2D' },
};
export function gradeColors(grade: string | null | undefined): { bg: string; text: string } | null {
  if (!grade) return null;
  return GRADE_COLORS[grade] || GRADE_COLORS[grade[0]] || null;
}
