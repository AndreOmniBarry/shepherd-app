// ============================================================
// SHEP.HERD — Shared branch-scoping resolution
// ============================================================
// At least 20 route files independently duplicated this ternary:
//   const branchId = user.role === 'branch_pastor' ? user.branch_id : searchParams.get('branch_id');
//   const branchFilter = branchId ? `&branch_id=eq.${branchId}` : '';
//
// For a role that's meant to be MANDATORILY scoped to its own branch
// (branch_pastor — see below re: `pa`), an empty branchFilter is
// indistinguishable between two very different situations:
//   1. An admin role (overseer/general_overseer/lead_tech/...) deliberately
//      omitted ?branch_id= to see the consolidated "all branches" view —
//      intentional, load-bearing product behavior. Do not touch this.
//   2. A branch_pastor whose account has no branch_id assigned yet (true
//      of every branch_pastor account today — nothing in the product
//      currently sets branch_id on a user) — this should NEVER silently
//      fall through to "all branches"; it should block/empty instead.
//
// resolveBranchScope() gives every route one place to tell these apart: a
// mandatorily-scoped role with no branch_id gets `forbidden: true` — the
// caller MUST return an empty result / 403, never proceed using the
// (empty) branchFilter as if it were a deliberate all-branches choice. A
// mandatorily-scoped role also can never override its own branch via
// ?branch_id= — that query param is only ever consulted for roles NOT in
// `mandatoryRoles`, so a branch_pastor cannot view another branch by
// passing one.
//
// A note on `pa`: three pre-existing accounts/finance routes
// (accounts/income, accounts/requisitions, analytics/giving/history) —
// and the already-hardened accounts/requisitions/[id] PATCH handler —
// treat `pa` as mandatorily branch-scoped alongside `branch_pastor`. But
// `pa` is documented elsewhere (church-config.ts's ROLE_LABELS: "PA /
// Church Admin", middleware.ts's "full access" role grouping alongside
// overseer/general_overseer/lead_tech, rolePortal.ts) as a church-wide
// admin-tier role, and the other ~17 routes fixed alongside these three
// all treat `pa` exactly like overseer/lead_tech (free ?branch_id=
// choice, unscoped by default). That is a real, pre-existing
// inconsistency in what `pa` means — not something this fix invents or
// resolves. Rather than unilaterally guessing which of the two
// conflicting conventions is "right" and silently changing `pa`'s
// behavior in 17+ routes (or in the 3 that already lock it down), every
// call site keeps its own pre-existing `mandatoryRoles` set exactly as it
// was: ['branch_pastor'] (the default) almost everywhere, and
// ['pa', 'branch_pastor'] only in the 3 routes that already used it. See
// the PR/report for the explicit flag of this as something the product
// should resolve deliberately.

import type { AuthUser, Role } from '@/types';

/** The uniform default: every route except the 3 accounts/finance routes noted above. */
export const DEFAULT_BRANCH_SCOPED_MANDATORY_ROLES: readonly Role[] = ['branch_pastor'];

export interface BranchScope {
  /** The branch id to filter on, or null for "no branch filter" (consolidated/all-branches view). */
  branchId: string | null;
  /** Ready-to-append PostgREST filter fragment, e.g. `&branch_id=eq.xyz`, or '' for none. */
  branchFilter: string;
  /**
   * True when the caller's role is in `mandatoryRoles` but their account
   * has no branch_id. The route MUST return an empty result / 403 in this
   * case — never fall through and use `branchFilter` (which will be '',
   * i.e. unscoped) as though it were a deliberate "view all branches"
   * choice.
   */
  forbidden: boolean;
}

/**
 * Resolves branch_id/branchFilter for a route, matching each route's
 * pre-existing behavior exactly for every role NOT in `mandatoryRoles`:
 *   - a mandatory role (default: branch_pastor only) → always their own
 *     user.branch_id; a client-supplied ?branch_id= is ignored entirely
 *     (they can never view another branch by passing one); a null
 *     branch_id → forbidden, not "all branches".
 *   - every other role → the optional ?branch_id= query param, or none
 *     for the consolidated "all branches" view — unchanged, load-bearing
 *     admin behavior.
 *
 * `searchParams` may be null for call sites that never accepted a
 * client-supplied branch_id at all (e.g. a DELETE endpoint that only ever
 * used user.branch_id for defense-in-depth scoping).
 */
export function resolveBranchScope(
  user: Pick<AuthUser, 'role' | 'branch_id'>,
  searchParams: URLSearchParams | null,
  mandatoryRoles: readonly Role[] = DEFAULT_BRANCH_SCOPED_MANDATORY_ROLES,
): BranchScope {
  const isMandatory = mandatoryRoles.includes(user.role);
  const branchId = isMandatory ? (user.branch_id ?? null) : (searchParams?.get('branch_id') ?? null);
  const branchFilter = branchId ? `&branch_id=eq.${branchId}` : '';
  const forbidden = isMandatory && !branchId;
  return { branchId, branchFilter, forbidden };
}

/** True if `role` is pinned to its own branch_id (can never view another branch or "all branches"). */
export function isBranchScopedMandatory(
  role: string,
  mandatoryRoles: readonly Role[] = DEFAULT_BRANCH_SCOPED_MANDATORY_ROLES,
): boolean {
  return (mandatoryRoles as readonly string[]).includes(role);
}
