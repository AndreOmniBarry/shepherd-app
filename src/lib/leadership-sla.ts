// ============================================================
// SHEP.HERD — Shared leadership composite-score math
// ============================================================
// The cell-level composite score (attendance rate, dispute-free accuracy,
// growth, submission promptness, meeting-logging promptness — see
// buildCellScores below) used to live only inline in
// src/app/api/cells/all/route.ts. It's extracted here so that:
//   1. cells/all keeps computing it exactly as before (it now just calls
//      buildCellScores — same fetches, same weights, same output shape),
//      and
//   2. the fellowship-head rollup (src/app/api/fellowship/cells/route.ts)
//      can call the *same* function, scoped to one fellowship's cells,
//      instead of re-deriving cell health a second, independent way that
//      could silently drift from cells/all's own numbers.
//
// Every composite below follows one rule, carried over from cells/all's
// own original comment: every input must be a real, measured number.
// Missing inputs (no submissions yet, no validations yet, a structurally
// absent concept like "department meetings") are dropped from the
// weighted average rather than assumed/zeroed — a brand-new unit with no
// data yet should show "not enough data", never a fake low score.
//
// Do NOT change the cell-level weights here — see this file's and
// cells/all's comments; a separate, more granular SLA-grade redesign is
// proposed but not yet approved, and this module deliberately keeps using
// gradeToScore()/computeSlaGrade() from src/lib/sla.ts exactly as-is.

import { gradeToScore } from '@/lib/sla';
import { EXCLUDE_DEMO_IDS } from '@/lib/demo-accounts';

export type WeightedInput = { value: number; weight: number };

// Generic weighted average that drops null inputs instead of assuming a
// value for them, and renormalizes over whichever inputs are actually
// present. This is the same pattern cells/all/route.ts always used inline
// (sum(value*weight) / sum(weight-of-present-inputs)) — centralized here
// so every composite in this file (and any future one) shares it.
export function weightedAverage(inputs: (WeightedInput | null | undefined)[]): number | null {
  const present = inputs.filter((i): i is WeightedInput => !!i);
  if (present.length === 0) return null;
  const totalWeight = present.reduce((s, w) => s + w.weight, 0);
  if (totalWeight <= 0) return null;
  return Math.round(present.reduce((s, w) => s + w.value * w.weight, 0) / totalWeight);
}

// Average of a list of 0-100 scores (e.g. gradeToScore() results), or null
// if there's nothing to average — used for any "promptness" input built
// from a list of individually-graded records.
export function avgScore(nums: (number | null | undefined)[]): number | null {
  const present = nums.filter((n): n is number => n !== null && n !== undefined);
  return present.length > 0 ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : null;
}

// ── Cell composite (attendance rate, accuracy, growth, submission and
// meeting promptness) — the exact formula from cells/all/route.ts,
// unchanged. weight 0.35 / 0.15 / 0.15 / 0.20 / 0.15.
export function computeCellOverallScore(input: {
  cappedRate: number;
  accuracy: number;
  growthScore: number;
  submissionSla: number | null;
  meetingSla: number | null;
}): number {
  const score = weightedAverage([
    { value: input.cappedRate, weight: 0.35 },
    { value: input.accuracy, weight: 0.15 },
    { value: input.growthScore, weight: 0.15 },
    input.submissionSla !== null ? { value: input.submissionSla, weight: 0.20 } : null,
    input.meetingSla !== null ? { value: input.meetingSla, weight: 0.15 } : null,
  ]);
  // cappedRate/accuracy/growthScore are always real numbers (never null),
  // so weightedAverage always has at least those three — never null here.
  return score as number;
}

export type CellScoreRow = {
  id: string;
  cell: string;
  fel: string;
  leader: string;
  members: number;
  avg: number;
  rate: number;
  trend: string;
  status: string;
  history: number[];
  last_meeting_date: string | null;
  meeting_this_week: boolean;
  meeting_sla_grade: string | null;
  submission_sla_score: number | null;
  meeting_sla_score: number | null;
  accuracy: number;
  overall_score: number;
};

// Builds the same per-cell rows cells/all/route.ts has always returned
// (same fetches, same 8-week/7-day windows, same trend/growth math, same
// composite via computeCellOverallScore above) — parameterized only by an
// optional extra filter on the initial cells query, so a caller can scope
// to one branch (cells/all's own use) or to one fellowship (the
// fellowship-head rollup's use) without duplicating any of the math.
export async function buildCellScores(params: {
  supabaseUrl: string;
  headers: Record<string, string>;
  churchId: string | null | undefined;
  /** e.g. '&branch_id=eq.xyz' or '&fellowship_id=eq.xyz' — appended to the cells query, before &church_id=. */
  extraCellsFilter?: string;
}): Promise<CellScoreRow[]> {
  const { supabaseUrl: SUPABASE_URL, headers, churchId } = params;
  const extraFilter = params.extraCellsFilter || '';

  const cellsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/cells?is_active=eq.true&select=id,name,fellowship_id,target_size,fellowships(name)&order=fellowship_id.asc,name.asc${extraFilter}&church_id=eq.${churchId}`,
    { headers }
  );
  const cells = await cellsRes.json();

  const leadersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?role=eq.cell_leader&is_active=eq.true&select=cell_id,full_name,email&church_id=eq.${churchId}${EXCLUDE_DEMO_IDS}`,
    { headers }
  );
  const leaders = await leadersRes.json();

  const membersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/members?membership_status=eq.active&select=cell_id&church_id=eq.${churchId}`,
    { headers }
  );
  const members = await membersRes.json();

  const memberCount: Record<string, number> = {};
  if (Array.isArray(members)) {
    members.forEach((m: Record<string, string>) => {
      if (m.cell_id) memberCount[m.cell_id] = (memberCount[m.cell_id] || 0) + 1;
    });
  }

  const leaderMap: Record<string, string> = {};
  if (Array.isArray(leaders)) {
    leaders.forEach((l: Record<string, string>) => {
      if (l.cell_id) leaderMap[l.cell_id] = l.full_name;
    });
  }

  const since = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
  const attRes = await fetch(
    `${SUPABASE_URL}/rest/v1/attendance_records?submitted_at=gte.${since}&select=id,cell_id,present_count,submitted_at,sla_grade&order=submitted_at.asc`,
    { headers }
  );
  const attRecords = await attRes.json();

  const attSlaMap: Record<string, number[]> = {};
  const attRecordIdsByCell: Record<string, string[]> = {};
  if (Array.isArray(attRecords)) {
    attRecords.forEach((r: Record<string, unknown>) => {
      const cid = r.cell_id as string;
      if (!cid) return;
      const score = gradeToScore(r.sla_grade as string | null);
      if (score !== null) { if (!attSlaMap[cid]) attSlaMap[cid] = []; attSlaMap[cid].push(score); }
      if (!attRecordIdsByCell[cid]) attRecordIdsByCell[cid] = [];
      attRecordIdsByCell[cid].push(r.id as string);
    });
  }

  const disputesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/attendance_disputes?created_at=gte.${since}&select=record_id`,
    { headers }
  );
  const disputesData = await disputesRes.json();
  const disputedRecordIds = new Set(Array.isArray(disputesData) ? disputesData.map((d: Record<string, string>) => d.record_id) : []);
  const accuracyMap: Record<string, number> = {};
  Object.keys(attRecordIdsByCell).forEach(cid => {
    const ids = attRecordIdsByCell[cid];
    const disputed = ids.filter(id => disputedRecordIds.has(id)).length;
    accuracyMap[cid] = ids.length > 0 ? Math.round(100 * (ids.length - disputed) / ids.length) : 100;
  });

  const meetingSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const meetingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/cell_meetings?order=meeting_date.desc&select=cell_id,meeting_date,attendance_count,sla_grade`,
    { headers }
  );
  const meetings = await meetingsRes.json();
  const meetingMap: Record<string, { last_meeting_date: string; this_week: boolean; sla_grade: string | null }> = {};
  const meetingSlaMap: Record<string, number[]> = {};
  if (Array.isArray(meetings)) {
    meetings.forEach((mt: Record<string, unknown>) => {
      const cid = mt.cell_id as string;
      if (!cid) return;
      if (!meetingMap[cid]) {
        meetingMap[cid] = {
          last_meeting_date: mt.meeting_date as string,
          this_week: (mt.meeting_date as string) >= meetingSince,
          sla_grade: mt.sla_grade as string | null,
        };
      }
      const score = gradeToScore(mt.sla_grade as string | null);
      if (score !== null) { if (!meetingSlaMap[cid]) meetingSlaMap[cid] = []; if (meetingSlaMap[cid].length < 8) meetingSlaMap[cid].push(score); }
    });
  }

  const attMap: Record<string, number[]> = {};
  if (Array.isArray(attRecords)) {
    attRecords.forEach((r: Record<string, unknown>) => {
      const cid = r.cell_id as string;
      if (cid) {
        if (!attMap[cid]) attMap[cid] = [];
        attMap[cid].push(r.present_count as number);
      }
    });
  }

  return Array.isArray(cells) ? cells.map((c: Record<string, unknown>) => {
    const fellowship = c.fellowships as Record<string, string>;
    const cid = c.id as string;
    const history = attMap[cid] || [];
    const avg = history.length > 0 ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
    const count = memberCount[cid] || 0;
    const rate = count > 0 ? Math.round((avg / count) * 100) : 0;

    let trend = '+0%';
    let trendPct = 0;
    let status = 'stable';
    if (history.length >= 4) {
      const recent = history.slice(-2).reduce((a, b) => a + b, 0) / 2;
      const older = history.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
      if (older > 0) {
        const pct = Math.round(((recent - older) / older) * 100);
        trendPct = pct;
        trend = pct >= 0 ? `+${pct}%` : `${pct}%`;
        status = pct >= 10 ? 'rising' : pct <= -10 ? 'alert' : pct <= -3 ? 'watch' : 'stable';
      }
    }

    const meeting = meetingMap[cid];
    const cappedRate = Math.min(rate, 95);
    const submissionSla = avgScore(attSlaMap[cid] || []);
    const meetingSla = avgScore(meetingSlaMap[cid] || []);
    const accuracy = accuracyMap[cid] ?? 100;
    const growthScore = Math.max(0, Math.min(100, 50 + trendPct * 2));
    const overallScore = computeCellOverallScore({ cappedRate, accuracy, growthScore, submissionSla, meetingSla });

    return {
      id: cid,
      cell: c.name as string,
      fel: fellowship?.name?.replace(' Fellowship', '') || 'Unknown',
      leader: leaderMap[cid] || 'Unassigned',
      members: count,
      avg,
      rate: cappedRate,
      trend,
      status,
      history,
      last_meeting_date: meeting?.last_meeting_date || null,
      meeting_this_week: meeting?.this_week || false,
      meeting_sla_grade: meeting?.sla_grade || null,
      submission_sla_score: submissionSla,
      meeting_sla_score: meetingSla,
      accuracy,
      overall_score: overallScore,
    };
  }) : [];
}

// ── Fellowship head ──────────────────────────────────────────────
// Two real inputs:
//  - cellsAvgScore: the plain average of computeCellOverallScore() (via
//    buildCellScores above) across every cell in this head's fellowship —
//    the exact same numbers a cells/all viewer would see for those cells,
//    never a second independent calculation.
//  - validationPromptness: gradeToScore(computeSlaGrade(submitted →
//    validated)) averaged across the monthly_attendance records this head
//    has actually approved/rejected. This is a new measurement — it did
//    not exist before this ticket — of the head's own turnaround time on
//    the one recurring judgment call their role makes.
//
// Weighted 60/40 toward cellsAvgScore. Reasoning: cellsAvgScore is the
// substantive, multi-factor read on how well the fellowship itself is
// being shepherded (it already folds in attendance, growth, dispute
// accuracy, and two promptness signals per cell), so it should dominate a
// leadership score named after the fellowship. validationPromptness is
// real and role-specific — it is the only personal-action metric this
// role has today (no equivalent to a cell leader's own "meeting logged"
// exists for a fellowship head) — so it gets a full 40%, more than any
// single promptness input carries inside the cell formula itself (20%),
// on the theory that a head's own responsiveness deserves a heavier
// single-input weight than one of several signals about a whole cell. But
// it stays a minority share: a fellowship head who validates instantly
// but whose cells are genuinely struggling should not outscore one who is
// slightly slower to validate but is running a healthy fellowship.
export function computeFellowshipHeadScore(input: {
  cellsAvgScore: number | null;
  validationPromptness: number | null;
}): number | null {
  return weightedAverage([
    input.cellsAvgScore !== null ? { value: input.cellsAvgScore, weight: 0.60 } : null,
    input.validationPromptness !== null ? { value: input.validationPromptness, weight: 0.40 } : null,
  ]);
}

// ── Department head ──────────────────────────────────────────────
// Departments have no attendance_disputes-equivalent (no dispute
// workflow at all for department attendance) and no cell_meetings
// equivalent (no separate "department meeting" event gets logged) — so
// only 3 of the cell formula's 5 inputs structurally exist for a
// department: attendance rate, submission promptness
// (department_attendance.sla_grade), and growth trend from department
// attendance history. Weights are the *same three weights* the cell
// formula already uses for these exact inputs (0.35 rate / 0.20
// submission / 0.15 growth) — not new numbers. weightedAverage above
// renormalizes over whichever of these are present, so passing the
// cell-formula's own weights here reproduces the cell formula's relative
// emphasis (rate > submission > growth) rather than inventing a fresh
// ranking. Roster-publishing promptness was investigated as a 4th input
// (see fellowship/../department SLA route comment) but workforce_rosters
// has no timestamp that isolates "the moment this roster was published"
// from "the moment it was last edited" — see that route's comment — so it
// is deliberately not included here rather than forced in as a
// mismeasured signal.
export function computeDepartmentHeadScore(input: {
  cappedRate: number | null;
  submissionSla: number | null;
  growthScore: number | null;
}): number | null {
  return weightedAverage([
    input.cappedRate !== null ? { value: input.cappedRate, weight: 0.35 } : null,
    input.submissionSla !== null ? { value: input.submissionSla, weight: 0.20 } : null,
    input.growthScore !== null ? { value: input.growthScore, weight: 0.15 } : null,
  ]);
}
