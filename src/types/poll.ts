// ============================================================
// SHEP.HERD — Poll client-side types
// ============================================================
// Mirrors the shapes returned by buildPollView() (src/lib/poll-analytics.ts)
// and the /results routes — kept here so both church-feed/page.tsx and
// chat/page.tsx (and the shared Poll* components) use one definition.

export type PollOption = {
  id: string;
  option_text: string;
  display_order: number;
  /** null until results become visible to this caller (Telegram convention). */
  count: number | null;
  pct: number | null;
};

export type PollView = {
  id: string;
  question: string;
  poll_type: 'single' | 'multiple';
  allow_vote_change: boolean;
  closes_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_by: string | null;
  created_at: string;
  is_closed: boolean;
  results_visible: boolean;
  total_voters: number | null;
  my_vote_option_ids: string[];
  /** Creator or leadership — can view /results and close the poll. */
  can_manage: boolean;
  options: PollOption[];
};

export type PollDraft = {
  question: string;
  poll_type: 'single' | 'multiple';
  options: string[];
  allow_vote_change: boolean;
  closes_at: string; // '' = no close date; otherwise a datetime-local value
};

export const emptyPollDraft = (): PollDraft => ({
  question: '', poll_type: 'single', options: ['', ''], allow_vote_change: true, closes_at: '',
});

export type PollTally = { option_id: string; option_text: string; count: number; pct: number };
export type PollResponseRate = { responded: number; audience_size: number; pct: number | null };
export type PollBreakdownUnit = {
  unit_id: string; unit_name: string; total_voters: number;
  options: { option_id: string; option_text: string; count: number; pct: number }[];
};
export type PollStructuralBreakdown = {
  dimension: 'branch' | 'cell' | null;
  dimension_label: string | null;
  note: string | null;
  units: PollBreakdownUnit[];
};
export type PollTimelineBucket = { bucket: string; count: number };
export type PollNonResponder = { id: string; full_name: string; role: string; branch_id: string | null; cell_id: string | null; fellowship_id: string | null; department_id: string | null };
export type PollVoterEntry = { user_id: string; full_name: string; role: string; voted_at: string };
export type PollOptionVoters = { option_id: string; option_text: string; voters: PollVoterEntry[] };

export type PollResults = {
  poll: { id: string; question: string; poll_type: 'single' | 'multiple'; allow_vote_change: boolean; closes_at: string | null; closed_at: string | null; closed_by: string | null; created_by: string | null; created_at: string; is_closed: boolean };
  tally: PollTally[];
  response_rate: PollResponseRate;
  structural_breakdown: PollStructuralBreakdown;
  engagement_timeline: PollTimelineBucket[];
  non_responders: PollNonResponder[];
  per_option_voters: PollOptionVoters[];
};
