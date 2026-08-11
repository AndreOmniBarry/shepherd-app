// ============================================================
// SHEP.HERD — Dynamic @group mention resolver
// ============================================================
// Builds the set of "@group-tag" mentions a caller can use right now,
// live from the church's actual structure (departments/branches/roles) —
// never a hardcoded taxonomy. Two entry points:
//   - listMentionGroups()      — for autocomplete suggestions in a composer
//   - extractGroupMentions()   — parses raw message/post text for @tokens
//                                 and resolves each one server-side
//
// SCOPING (founder-locked, enforced here, not just hidden client-side):
//   - overseer / general_overseer ("GO") get interbranch reach — their
//     tags resolve church-wide.
//   - every other role is branch-scoped — their tags resolve only within
//     their own user.branch_id, no matter what tag string is POSTed.
// A non-GO caller with no branch_id assigned gets an empty group-tag
// catalog entirely (fail-closed, same posture as resolveBranchScope's
// `forbidden` case) rather than silently falling through to "all
// branches" or "no filter".
//
// Every resolution re-derives its own member list from the caller's role/
// branch on every call — a raw "@branch_pastors" (or any other tag)
// string arriving in a POST body is never trusted as already scoped; the
// resolver recomputes who that tag means for *this* caller from scratch.
// ============================================================

import { getRoleLabel, pluralizeLabel, type RoleLabelConfig } from '@/lib/church-config';

const S = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = () => ({ 'apikey': K, 'Authorization': `Bearer ${K}`, 'Content-Type': 'application/json' });

const GO_ROLES = ['overseer', 'general_overseer'];

export type CallerCtx = {
  id: string;
  role: string;
  church_id: string | null | undefined;
  branch_id: string | null | undefined;
};

export type MentionGroup = {
  /** Lowercase token used after '@', e.g. "cell_leaders", "dept_heads", "choir". */
  tag: string;
  /** Human-readable label for UI, e.g. "Cell Leaders", "Choir". */
  label: string;
  kind: 'tier2_leaders' | 'tier1_leaders' | 'dept_heads' | 'branch_pastors' | 'department';
  department_id?: string;
};

export type ResolvedMentionGroup = { tag: string; label: string; userIds: string[] };

function isGO(role: string): boolean {
  return GO_ROLES.includes(role);
}

/** Slugifies a display label into the lowercase_snake token used after '@'. */
function slugify(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'group';
}

async function getChurchConfigLabels(churchId: string): Promise<RoleLabelConfig> {
  try {
    const res = await fetch(
      `${S}/rest/v1/church_config?church_id=eq.${churchId}&limit=1&select=structure_type,tier1_head_label,tier2_head_label`,
      { headers: H() }
    );
    const data = await res.json().catch(() => []);
    return (Array.isArray(data) ? data[0] : null) || {};
  } catch {
    return {};
  }
}

async function fetchUserIdsByRole(role: string, churchId: string, branchId: string | null): Promise<string[]> {
  const branchFilter = branchId ? `&branch_id=eq.${branchId}` : '';
  const res = await fetch(
    `${S}/rest/v1/users?role=eq.${role}&is_active=eq.true&church_id=eq.${churchId}${branchFilter}&select=id`,
    { headers: H() }
  );
  const rows = await res.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []).map((r: { id: string }) => r.id);
}

async function fetchDepartmentHeadIds(deptIds: string[], churchId: string): Promise<string[]> {
  if (deptIds.length === 0) return [];
  const res = await fetch(
    `${S}/rest/v1/users?role=eq.department_head&is_active=eq.true&department_id=in.(${deptIds.join(',')})&church_id=eq.${churchId}&select=id`,
    { headers: H() }
  );
  const rows = await res.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []).map((r: { id: string }) => r.id);
}

// Rank-and-file department members: department_members references
// members(id), not users(id) directly. Mirrors the exact cross-check
// already used in POST /api/feed/groups to auto-populate a new
// department's feed group — only member_ids that also resolve to an
// active login account are notifiable.
async function fetchDepartmentMemberUserIds(deptIds: string[]): Promise<string[]> {
  if (deptIds.length === 0) return [];
  const memRes = await fetch(
    `${S}/rest/v1/department_members?department_id=in.(${deptIds.join(',')})&select=member_id`,
    { headers: H() }
  );
  const memRows: { member_id: string }[] = await memRes.json().catch(() => []);
  const memberIds = [...new Set((Array.isArray(memRows) ? memRows : []).map(m => m.member_id).filter(Boolean))];
  if (memberIds.length === 0) return [];
  const userRes = await fetch(
    `${S}/rest/v1/users?id=in.(${memberIds.join(',')})&is_active=eq.true&select=id`,
    { headers: H() }
  );
  const userRows: { id: string }[] = await userRes.json().catch(() => []);
  return (Array.isArray(userRows) ? userRows : []).map(u => u.id);
}

/**
 * Lists the group tags a caller can mention right now, for composer
 * autocomplete. Purely a suggestion list — the real enforcement happens
 * again, independently, in resolveMentionGroupTag when a message/post is
 * actually saved, so a stale or tampered suggestion list can never widen
 * who gets notified.
 */
export async function listMentionGroups(caller: CallerCtx): Promise<MentionGroup[]> {
  if (!caller.church_id) return [];
  const churchWide = isGO(caller.role);
  if (!churchWide && !caller.branch_id) return [];

  const churchFilter = `&church_id=eq.${caller.church_id}`;
  const branchFilter = churchWide ? '' : `&branch_id=eq.${caller.branch_id}`;
  const cfg = await getChurchConfigLabels(caller.church_id);

  const groups: MentionGroup[] = [];

  const tier2Label = pluralizeLabel(getRoleLabel('cell_leader', cfg));
  groups.push({ tag: slugify(tier2Label), label: tier2Label, kind: 'tier2_leaders' });

  const tier1Label = pluralizeLabel(getRoleLabel('fellowship_head', cfg));
  groups.push({ tag: slugify(tier1Label), label: tier1Label, kind: 'tier1_leaders' });

  groups.push({ tag: 'dept_heads', label: 'Department Heads', kind: 'dept_heads' });

  // branch_pastors is only meaningful/shown for multi-branch churches.
  const branchesRes = await fetch(`${S}/rest/v1/branches?select=id${churchFilter}&limit=2`, { headers: H() });
  const branchRows = await branchesRes.json().catch(() => []);
  if (Array.isArray(branchRows) && branchRows.length > 1) {
    groups.push({ tag: 'branch_pastors', label: 'Branch Pastors', kind: 'branch_pastors' });
  }

  // One tag per department actually in scope — own branch only for a
  // non-GO caller; every branch for a GO caller, with same-named
  // departments across branches collapsed into a single church-wide tag
  // (this is exactly the "interbranch reach" a GO is meant to have).
  const deptRes = await fetch(`${S}/rest/v1/departments?select=id,name${branchFilter}${churchFilter}&order=name.asc`, { headers: H() });
  const deptRows: { id: string; name: string }[] = await deptRes.json().catch(() => []);
  const seenNames = new Set<string>();
  (Array.isArray(deptRows) ? deptRows : []).forEach(d => {
    const key = d.name.trim().toLowerCase();
    if (seenNames.has(key)) return;
    seenNames.add(key);
    groups.push({ tag: slugify(d.name), label: d.name, kind: 'department', department_id: d.id });
  });

  return groups;
}

/**
 * Resolves one raw "@tag" token (already stripped of its leading '@') to
 * the list of user ids it means for THIS caller right now. Always
 * recomputes from the caller's own role/branch — the tag string itself
 * carries no scope of its own. Returns null when the tag doesn't match
 * anything in the caller's own catalog (e.g. unknown word, or a
 * plain @FirstName that happens to not collide with a group tag).
 */
export async function resolveMentionGroupTag(rawTag: string, caller: CallerCtx): Promise<ResolvedMentionGroup | null> {
  if (!caller.church_id) return null;
  const churchWide = isGO(caller.role);
  if (!churchWide && !caller.branch_id) return null;

  const tag = rawTag.toLowerCase();
  const scopeBranchId = churchWide ? null : (caller.branch_id as string);
  const churchFilter = `&church_id=eq.${caller.church_id}`;
  const branchFilter = churchWide ? '' : `&branch_id=eq.${caller.branch_id}`;

  const cfg = await getChurchConfigLabels(caller.church_id);
  const tier2Label = pluralizeLabel(getRoleLabel('cell_leader', cfg));
  const tier2Tag = slugify(tier2Label);
  const tier1Label = pluralizeLabel(getRoleLabel('fellowship_head', cfg));
  const tier1Tag = slugify(tier1Label);

  if (tag === tier2Tag) {
    return { tag, label: tier2Label, userIds: await fetchUserIdsByRole('cell_leader', caller.church_id, scopeBranchId) };
  }
  if (tag === tier1Tag) {
    return { tag, label: tier1Label, userIds: await fetchUserIdsByRole('fellowship_head', caller.church_id, scopeBranchId) };
  }
  if (tag === 'dept_heads') {
    return { tag, label: 'Department Heads', userIds: await fetchUserIdsByRole('department_head', caller.church_id, scopeBranchId) };
  }
  if (tag === 'branch_pastors') {
    return { tag, label: 'Branch Pastors', userIds: await fetchUserIdsByRole('branch_pastor', caller.church_id, scopeBranchId) };
  }

  // Department tag — re-derive matching department ids from the caller's
  // own scope (never from anything client-supplied) before resolving members.
  const deptRes = await fetch(`${S}/rest/v1/departments?select=id,name${branchFilter}${churchFilter}`, { headers: H() });
  const deptRows: { id: string; name: string }[] = await deptRes.json().catch(() => []);
  const matches = (Array.isArray(deptRows) ? deptRows : []).filter(d => slugify(d.name) === tag);
  if (matches.length === 0) return null;
  const deptIds = matches.map(d => d.id);

  const [headIds, memberIds] = await Promise.all([
    fetchDepartmentHeadIds(deptIds, caller.church_id),
    fetchDepartmentMemberUserIds(deptIds),
  ]);
  return { tag, label: matches[0].name, userIds: [...new Set([...headIds, ...memberIds])] };
}

/**
 * Scans free text for @tokens and resolves every one that matches a
 * group tag in the caller's own catalog. Tokens that don't match any
 * known group tag are ignored here — they're either a plain individual
 * @FirstName mention (handled separately by each composer's own
 * participant-matching) or just text that happens to contain an '@'.
 */
export async function extractGroupMentions(
  text: string,
  caller: CallerCtx
): Promise<{ userIds: string[]; matchedTags: { tag: string; label: string }[] }> {
  if (!text) return { userIds: [], matchedTags: [] };
  const tokens = [...new Set((text.match(/@([a-zA-Z][a-zA-Z0-9_]*)/g) || []).map(t => t.slice(1).toLowerCase()))];
  if (tokens.length === 0) return { userIds: [], matchedTags: [] };

  const userIds = new Set<string>();
  const matchedTags: { tag: string; label: string }[] = [];
  for (const token of tokens) {
    const resolved = await resolveMentionGroupTag(token, caller);
    if (resolved) {
      resolved.userIds.forEach(id => userIds.add(id));
      matchedTags.push({ tag: resolved.tag, label: resolved.label });
    }
  }
  return { userIds: [...userIds], matchedTags };
}
