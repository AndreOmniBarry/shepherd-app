// ============================================================
// SHEP.HERD — Poll mechanics + analytics, shared by Church Feed polls
// (feed_posts) and group-chat polls (chat_messages).
// ============================================================
// Kept in one place so "who's the eligible audience for this poll",
// "is this poll closed", "cast/change a vote", and "what's the
// meaningful structural breakdown for this church" are each computed
// exactly once, the same way, everywhere they're needed.
//
// VISIBILITY MODEL (fixed, not configurable — no "anonymous" toggle):
//   - The poll's creator, and any leadership-role caller (LEADERSHIP,
//     below) in the same church, always get full per-voter attribution
//     via the /results routes.
//   - Everyone else never gets a per-voter "who voted for what" mapping
//     from any route in this app — the plain poll card (embedded in
//     GET .../posts or GET .../messages) only ever exposes aggregate
//     tallies, and the /results routes refuse to serve anyone outside
//     creator/leadership at all. There is no flag that changes this.
//
// AUDIENCE RESOLUTION differs by surface, deliberately not shared:
//   - Church Feed poll -> getEligibleFeedAudience(): mirrors, rather than
//     reinvents, Church Feed's own two membership models (department
//     group -> feed_group_members; church-wide group -> active users in
//     branch/church scope), exactly as GET /api/feed/groups computes.
//   - Group-chat poll -> getEligibleChatAudience(): the thread's actual
//     chat_participants list — a meaningfully different audience source,
//     never the feed's structural-scope calculation.
// ============================================================

import { getLeafUnitLabel, getBranchLabel, type StructureType } from '@/lib/church-config';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

export const LEADERSHIP = ['overseer', 'general_overseer', 'branch_pastor', 'pa', 'lead_tech'];

/** Fixed two-tier visibility check — no flag, no per-poll override. */
export function canSeeFullPollDetail(pollCreatedBy: string | null, caller: { id: string; role: string }): boolean {
  return caller.id === pollCreatedBy || LEADERSHIP.includes(caller.role);
}

// ── Poll row + parent resolution ───────────────────────────────────

export type PollRow = {
  id: string;
  post_id: string | null;
  message_id: string | null;
  question: string;
  poll_type: 'single' | 'multiple';
  allow_vote_change: boolean;
  closes_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
};

export async function getPoll(pollId: string): Promise<PollRow | null> {
  const res = await fetch(`${S}/rest/v1/feed_polls?id=eq.${pollId}&select=id,post_id,message_id,question,poll_type,allow_vote_change,closes_at,closed_by,closed_at,created_by,created_at&limit=1`, { headers: H() });
  const data = await res.json().catch(() => []);
  return data?.[0] || null;
}

export function isPollClosed(poll: PollRow): boolean {
  if (poll.closed_at) return true;
  if (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) return true;
  return false;
}

// ── Poll "card" view — the aggregate-only shape embedded in a plain post/
// message list. Built in exactly one place so the vote-gated hiding rule
// (Telegram convention: no tally until you've voted, the poll closes, or
// you're the creator/leadership) can never drift between the feed route,
// the chat route, and the vote routes that each need to render it. This
// NEVER includes a per-voter mapping — that only ever comes from the
// /results routes, gated separately by canSeeFullPollDetail.

export type PollOptionRow = { id: string; option_text: string; display_order: number };
export type PollVoteRow = { option_id: string; user_id: string };

export function buildPollView(poll: PollRow, options: PollOptionRow[], votes: PollVoteRow[], caller: { id: string; role: string }) {
  const myVoteOptionIds = votes.filter(v => v.user_id === caller.id).map(v => v.option_id);
  const closed = isPollClosed(poll);
  const canManage = canSeeFullPollDetail(poll.created_by, caller);
  const resultsVisible = myVoteOptionIds.length > 0 || closed || canManage;
  const distinctVoters = new Set(votes.map(v => v.user_id)).size;
  const countByOption = new Map<string, number>();
  votes.forEach(v => countByOption.set(v.option_id, (countByOption.get(v.option_id) || 0) + 1));

  const optionsOut = [...options].sort((a, b) => a.display_order - b.display_order).map(o => ({
    id: o.id, option_text: o.option_text, display_order: o.display_order,
    count: resultsVisible ? (countByOption.get(o.id) || 0) : null,
    pct: resultsVisible && distinctVoters > 0 ? Math.round(((countByOption.get(o.id) || 0) / distinctVoters) * 1000) / 10 : null,
  }));

  return {
    id: poll.id, question: poll.question, poll_type: poll.poll_type, allow_vote_change: poll.allow_vote_change,
    closes_at: poll.closes_at, closed_at: poll.closed_at, closed_by: poll.closed_by, created_by: poll.created_by, created_at: poll.created_at,
    is_closed: closed, results_visible: resultsVisible,
    total_voters: resultsVisible ? distinctVoters : null,
    my_vote_option_ids: myVoteOptionIds,
    can_manage: canManage,
    options: optionsOut,
  };
}

export type PollParent =
  | { kind: 'feed'; pollId: string; postId: string; groupId: string; churchId: string }
  | { kind: 'chat'; pollId: string; messageId: string; threadId: string; churchId: string };

/**
 * Resolves a poll to its parent post/message and, from there, to its
 * group/thread and church — the same tenant-ownership chain every other
 * feed/chat route already walks (post -> group -> church_id, or
 * message -> thread -> church_id) before trusting a client-supplied id.
 * Returns null if the poll, or its parent, doesn't resolve at all.
 */
export async function resolvePollParent(pollId: string): Promise<PollParent | null> {
  const pollRes = await fetch(`${S}/rest/v1/feed_polls?id=eq.${pollId}&select=id,post_id,message_id&limit=1`, { headers: H() });
  const poll = (await pollRes.json().catch(() => []))?.[0];
  if (!poll) return null;

  if (poll.post_id) {
    const postRes = await fetch(`${S}/rest/v1/feed_posts?id=eq.${poll.post_id}&select=group_id&limit=1`, { headers: H() });
    const post = (await postRes.json().catch(() => []))?.[0];
    if (!post?.group_id) return null;
    const groupRes = await fetch(`${S}/rest/v1/feed_groups?id=eq.${post.group_id}&select=id,church_id&limit=1`, { headers: H() });
    const group = (await groupRes.json().catch(() => []))?.[0];
    if (!group) return null;
    return { kind: 'feed', pollId, postId: poll.post_id, groupId: post.group_id, churchId: group.church_id };
  }

  if (poll.message_id) {
    const msgRes = await fetch(`${S}/rest/v1/chat_messages?id=eq.${poll.message_id}&select=thread_id&limit=1`, { headers: H() });
    const msg = (await msgRes.json().catch(() => []))?.[0];
    if (!msg?.thread_id) return null;
    const threadRes = await fetch(`${S}/rest/v1/chat_threads?id=eq.${msg.thread_id}&select=id,church_id&limit=1`, { headers: H() });
    const thread = (await threadRes.json().catch(() => []))?.[0];
    if (!thread) return null;
    return { kind: 'chat', pollId, messageId: poll.message_id, threadId: msg.thread_id, churchId: thread.church_id };
  }

  return null;
}

// ── Vote casting (shared by the feed and chat vote routes) ─────────

export type CastVoteResult = { ok: true; optionIds: string[] } | { ok: false; status: number; message: string };

/**
 * Casts or changes a vote. Delete-then-insert: a re-vote always replaces
 * the caller's prior selection(s) with the newly submitted set — works
 * identically for single-choice (one row survives) and multiple-choice
 * (the full new set survives). Rejects outright if the poll disallows
 * vote-changing and the caller already has a vote on record.
 */
export async function castPollVote(poll: PollRow, userId: string, optionIds: string[]): Promise<CastVoteResult> {
  if (isPollClosed(poll)) return { ok: false, status: 409, message: 'This poll is closed' };

  const uniqueIds = [...new Set(optionIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { ok: false, status: 400, message: 'Select at least one option' };
  if (poll.poll_type === 'single' && uniqueIds.length > 1) return { ok: false, status: 400, message: 'This poll only allows one choice' };

  const optRes = await fetch(`${S}/rest/v1/feed_poll_options?poll_id=eq.${poll.id}&select=id`, { headers: H() });
  const optRows: { id: string }[] = await optRes.json().catch(() => []);
  const validIds = new Set((Array.isArray(optRows) ? optRows : []).map(o => o.id));
  if (!uniqueIds.every(id => validIds.has(id))) return { ok: false, status: 400, message: 'One or more options do not belong to this poll' };

  const existingRes = await fetch(`${S}/rest/v1/feed_poll_votes?poll_id=eq.${poll.id}&user_id=eq.${userId}&select=option_id`, { headers: H() });
  const existing = await existingRes.json().catch(() => []);
  const hasExisting = Array.isArray(existing) && existing.length > 0;
  if (hasExisting && !poll.allow_vote_change) {
    return { ok: false, status: 403, message: 'Vote changes are not allowed for this poll' };
  }

  if (hasExisting) {
    await fetch(`${S}/rest/v1/feed_poll_votes?poll_id=eq.${poll.id}&user_id=eq.${userId}`, { method: 'DELETE', headers: H() });
  }

  const insertRes = await fetch(`${S}/rest/v1/feed_poll_votes`, {
    method: 'POST', headers: { ...H(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(uniqueIds.map(optionId => ({ poll_id: poll.id, option_id: optionId, user_id: userId }))),
  });
  if (!insertRes.ok) {
    const err = await insertRes.text().catch(() => '');
    console.error('[castPollVote] insert failed', insertRes.status, err);
    return { ok: false, status: 502, message: 'Failed to record your vote' };
  }

  return { ok: true, optionIds: uniqueIds };
}

// ── Eligible audience ────────────────────────────────────────────

export type AudienceUser = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  cell_id: string | null;
  fellowship_id: string | null;
  department_id: string | null;
};

export type FeedPollGroup = { id: string; type: 'church' | 'department'; department_id: string | null; branch_id: string | null; church_id: string };

/**
 * The full set of people a Church Feed poll's group is addressed to —
 * used both as the response-rate denominator and as the non-responder
 * candidate pool. Always re-derived server-side from the group's own
 * scope, never from anything client-supplied.
 */
export async function getEligibleFeedAudience(group: FeedPollGroup): Promise<AudienceUser[]> {
  if (group.type === 'department') {
    // feed_group_members is exactly the membership list POST /api/feed/groups
    // populated at group-creation time from department_members + the
    // creating department_head — reused here rather than re-deriving the
    // department_members join independently.
    const memberRes = await fetch(`${S}/rest/v1/feed_group_members?group_id=eq.${group.id}&select=user_id`, { headers: H() });
    const memberRows: { user_id: string }[] = await memberRes.json().catch(() => []);
    const ids = [...new Set((Array.isArray(memberRows) ? memberRows : []).map(m => m.user_id))];
    if (ids.length === 0) return [];
    const usersRes = await fetch(
      `${S}/rest/v1/users?id=in.(${ids.join(',')})&is_active=eq.true&church_id=eq.${group.church_id}&select=id,full_name,role,branch_id,cell_id,fellowship_id,department_id`,
      { headers: H() }
    );
    const rows = await usersRes.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
  }

  const branchFilter = group.branch_id ? `&branch_id=eq.${group.branch_id}` : '';
  const usersRes = await fetch(
    `${S}/rest/v1/users?church_id=eq.${group.church_id}&is_active=eq.true${branchFilter}&select=id,full_name,role,branch_id,cell_id,fellowship_id,department_id`,
    { headers: H() }
  );
  const rows = await usersRes.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * The eligible audience for a group-chat poll is the thread's actual
 * participant list — deliberately NOT the feed's church/branch/department
 * structural-scope calculation, since a group chat's membership is
 * whoever was actually added to it, not a structural cohort.
 */
export async function getEligibleChatAudience(threadId: string, churchId: string): Promise<AudienceUser[]> {
  const partRes = await fetch(`${S}/rest/v1/chat_participants?thread_id=eq.${threadId}&select=user_id`, { headers: H() });
  const partRows: { user_id: string }[] = await partRes.json().catch(() => []);
  const ids = [...new Set((Array.isArray(partRows) ? partRows : []).map(p => p.user_id))];
  if (ids.length === 0) return [];
  const usersRes = await fetch(
    `${S}/rest/v1/users?id=in.(${ids.join(',')})&is_active=eq.true&church_id=eq.${churchId}&select=id,full_name,role,branch_id,cell_id,fellowship_id,department_id`,
    { headers: H() }
  );
  const rows = await usersRes.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

// ── Structural breakdown (shared — audience source doesn't matter) ──

export type ChurchStructureCfg = { structure_type: StructureType | null; tier1_label: string | null; tier2_label: string | null; tier3_label: string | null };

export async function getChurchStructureCfg(churchId: string): Promise<ChurchStructureCfg> {
  try {
    const res = await fetch(`${S}/rest/v1/church_config?church_id=eq.${churchId}&limit=1&select=structure_type,tier1_label,tier2_label,tier3_label`, { headers: H() });
    const data = await res.json().catch(() => []);
    return (Array.isArray(data) ? data[0] : null) || { structure_type: null, tier1_label: null, tier2_label: null, tier3_label: null };
  } catch {
    return { structure_type: null, tier1_label: null, tier2_label: null, tier3_label: null };
  }
}

export type BreakdownUnit = {
  unit_id: string;
  unit_name: string;
  total_voters: number;
  options: { option_id: string; option_text: string; count: number; pct: number }[];
};

export type StructuralBreakdown = {
  dimension: 'branch' | 'cell' | null;
  dimension_label: string | null; // e.g. "Branch" or the church's own leaf-unit label ("Cell", "District", "Unit", …)
  note: string | null; // set when breakdown was intentionally omitted, and why
  units: BreakdownUnit[];
};

/**
 * Picks ONE breakdown dimension rather than always showing every possible
 * cross-tab — a single-congregation church has no branches and showing an
 * empty/meaningless "by branch" table would be noise, not analytics.
 * Priority: if the audience actually spans more than one branch, that's
 * the most informative cut (branch_pastor accountability); otherwise fall
 * back to the church's own leaf structural unit (cell/district/unit/home
 * group, per structure_type) unless the church is a single congregation
 * with no sub-structure to break down by at all.
 */
export async function computeStructuralBreakdown(
  votes: { option_id: string; user_id: string }[],
  audienceById: Map<string, AudienceUser>,
  options: { id: string; option_text: string }[],
  cfg: ChurchStructureCfg
): Promise<StructuralBreakdown> {
  const voterAudience = votes
    .map(v => audienceById.get(v.user_id))
    .filter((u): u is AudienceUser => !!u);
  const distinctBranches = new Set(voterAudience.map(u => u.branch_id).filter(Boolean));

  let dimension: 'branch' | 'cell' | null = null;
  let dimensionLabel: string | null = null;
  let note: string | null = null;

  if (distinctBranches.size > 1) {
    dimension = 'branch';
    dimensionLabel = getBranchLabel({ structure_type: cfg.structure_type || undefined, tier1_label: cfg.tier1_label });
  } else if (cfg.structure_type && cfg.structure_type !== 'single') {
    dimension = 'cell';
    dimensionLabel = getLeafUnitLabel({ structure_type: cfg.structure_type, tier2_label: cfg.tier2_label, tier3_label: cfg.tier3_label });
  } else {
    note = cfg.structure_type === 'single'
      ? 'This church has no sub-structure (single congregation) — no structural breakdown to show.'
      : 'Not enough structural spread among voters to break down meaningfully.';
  }

  if (!dimension) return { dimension: null, dimension_label: null, note, units: [] };

  const idKey = dimension === 'branch' ? 'branch_id' : 'cell_id';
  const nameTable = dimension === 'branch' ? 'branches' : 'cells';

  // Group votes by unit, then by option, within that unit.
  const unitVoteMap = new Map<string, { userIds: Set<string>; optionCounts: Map<string, number> }>();
  for (const v of votes) {
    const u = audienceById.get(v.user_id);
    const unitId = u ? (u[idKey] as string | null) : null;
    if (!unitId) continue;
    if (!unitVoteMap.has(unitId)) unitVoteMap.set(unitId, { userIds: new Set(), optionCounts: new Map() });
    const bucket = unitVoteMap.get(unitId)!;
    bucket.userIds.add(v.user_id);
    bucket.optionCounts.set(v.option_id, (bucket.optionCounts.get(v.option_id) || 0) + 1);
  }

  if (unitVoteMap.size === 0) {
    return { dimension, dimension_label: dimensionLabel, note: `No votes yet with a resolvable ${dimensionLabel || 'unit'}.`, units: [] };
  }

  const unitIds = [...unitVoteMap.keys()];
  const namesRes = await fetch(`${S}/rest/v1/${nameTable}?id=in.(${unitIds.join(',')})&select=id,name`, { headers: H() });
  const nameRows: { id: string; name: string }[] = await namesRes.json().catch(() => []);
  const nameMap = new Map((Array.isArray(nameRows) ? nameRows : []).map(r => [r.id, r.name]));

  const units: BreakdownUnit[] = unitIds.map(unitId => {
    const bucket = unitVoteMap.get(unitId)!;
    const totalVoters = bucket.userIds.size;
    return {
      unit_id: unitId,
      unit_name: nameMap.get(unitId) || 'Unnamed',
      total_voters: totalVoters,
      options: options.map(o => {
        const count = bucket.optionCounts.get(o.id) || 0;
        return { option_id: o.id, option_text: o.option_text, count, pct: totalVoters > 0 ? Math.round((count / totalVoters) * 1000) / 10 : 0 };
      }),
    };
  }).sort((a, b) => a.unit_name.localeCompare(b.unit_name));

  return { dimension, dimension_label: dimensionLabel, note: null, units };
}

export type TimelineBucket = { bucket: string; count: number };

/**
 * Vote-count momentum over time — bucketed by hour for a poll open <=72h
 * (or not yet closed with a short-enough span), by day for anything
 * longer, so a poll that's been open for weeks doesn't render an
 * unreadable wall of hourly bars.
 */
export function computeEngagementTimeline(latestVoteAtByUser: Date[], createdAt: Date, endAt: Date): TimelineBucket[] {
  if (latestVoteAtByUser.length === 0) return [];
  const spanMs = Math.max(endAt.getTime() - createdAt.getTime(), 60 * 60 * 1000);
  const byDay = spanMs > 72 * 60 * 60 * 1000;
  const bucketMs = byDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;

  const counts = new Map<string, number>();
  for (const ts of latestVoteAtByUser) {
    const bucketStart = new Date(Math.floor(ts.getTime() / bucketMs) * bucketMs);
    const key = bucketStart.toISOString();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, count]) => ({ bucket, count }));
}
