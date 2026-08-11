# Multi-Tenant Scoping Audit

Date: 2026-08-09
Scope: every `src/app/api/**/route.ts` — 119 route files.

## Canonical pattern

Established from `src/app/api/profile/route.ts`, `src/app/api/attendance/route.ts`, and
`src/app/api/settings/church-config/route.ts`:

- Auth: read the `shepherd_token` cookie (sometimes also `Authorization: Bearer`), verify with
  `verifyToken()` from `src/lib/auth.ts`, decode via `payloadToAuthUser()` into an `AuthUser` whose
  `church_id` is sourced from the signed JWT — itself set at login/invite time from `users.church_id`,
  a FK to `churches.id` (the real tenant id).
- Every query against a tenant-owned table filters `church_id=eq.${user.church_id}`.
- `church_config` has its own `id` PK distinct from `churches.id`; the correct join key from a
  session is always `church_config.church_id = eq.${user.church_id}` — never `church_config.id`
  (the one exception is `/api/admin/churches`, a platform-admin route whose whole job is to look up
  church_config rows by their own `id` — verified intentional, not confused).
- Tables with no `church_id` column of their own (`attendance_records`, `absence_reports`,
  `member_additions`, `member_removals`, `feed_posts`, `department_attendance`, `monthly_attendance`,
  `workforce_rosters`, etc.) are scoped transitively — via the cells/services/users/groups they
  belong to, which do carry `church_id`.
- `[id]` path params and client-supplied ids in the body/query must be re-validated against the
  caller's own `church_id` (and, where relevant, `branch_id`/`fellowship_id`/`department_id`) before
  being used in a read or write — never trusted alone.
- `/api/admin/*` routes gate on an actual platform-admin role check in code (`lead_tech`,
  `overseer`/`general_overseer` for church-level admin actions), not just "logged in".

## Legitimately public / unauthenticated (verified, not flagged)

`/api/auth/login`, `/api/auth/logout`, `/api/auth/register` (fixed — see below),
`/api/register/validate`, `/api/register/complete`, `/api/events/public`, `/api/events/register`
(anonymous event sign-up), `/api/webhooks/paystack` (HMAC-signature verified), `/api/admin/health-check`
(cron-secret verified). `/api/cells` has a documented, accepted known gap for anonymous
self-registration requests (no church-slug in the URL yet to resolve tenant from) — pre-existing,
intentionally left as-is per its own code comment; not something this pass invented a URL-scheme
fix for.

## Findings summary

- **119 routes checked.**
- **105 PASS on first read** (already correctly scoped, several with defensive comments showing
  they'd been hardened in earlier passes).
- **14 FAIL → fixed** in this pass.
- **1 flagged for manual follow-up**, not fixed blindly (see below) — `/api/settings`.

## Fixed (14)

| # | Route | Bug | Fix |
|---|-------|-----|-----|
| 1 | `src/app/api/accounts/requisitions/[id]/route.ts` | PATCH only re-validated `church_id` for `pa`/`branch_pastor` roles (branch check only) — `overseer`/`general_overseer`/`lead_tech` could approve/pay/reject **any church's** requisition by id (IDOR). | Added a `church_id` ownership check for every role before allowing the action; branch check still applies on top for `pa`/`branch_pastor`. Also added `&church_id=eq.` to the final PATCH itself as defense in depth. |
| 2 | `src/app/api/auth/register/route.ts` | Self-registration inserted the new `cell_leader` user row with **no `church_id`** at all — the account would be permanently invisible to every church_id-scoped query after approval. | Selected `church_id` from the chosen cell and set it on the new user row. |
| 3 | `src/app/api/cells/history/route.ts` | Admin roles (`overseer`/`general_overseer`/`branch_pastor`/`pa`/`lead_tech`) could pass any `cell_id` query param and view **another church's** cell attendance history — only `fellowship_head` had an ownership check. | Added a church-ownership check (+ branch check for `branch_pastor`) for admin roles before using the client-supplied `cell_id`. |
| 4 | `src/app/api/chat/messages/[id]/react/route.ts` | React/un-react endpoint took `message_id` from the URL and never checked the caller was a participant of the message's thread — any authenticated user could react to any message by guessing/enumerating ids, including messages in threads (and churches) they were never added to. | Added a lookup from message → thread → participant check before allowing the reaction, matching the pattern already used by the sibling `chat/threads/[id]/messages` route. |
| 5 | `src/app/api/department/history/route.ts` | Same IDOR shape as #3, for `department_id` — admin roles could view another church's department attendance history by id. | Added a church-ownership check (+ branch check for `branch_pastor`) for admin roles. |
| 6 | `src/app/api/fellowship/disputes/route.ts` | POST (raise a dispute) fetched the `attendance_records` row by `record_id` with **no church/fellowship check at all** — a fellowship head could dispute another fellowship's, or another church's, attendance record just by guessing its id. | Added a check that the record's cell belongs to the caller's own church and fellowship before allowing the dispute. |
| 7 | `src/app/api/fellowship/history/route.ts` | Same IDOR shape as #3/#5, for `fellowship_id` — admin roles (`overseer`/`pa`/`lead_tech`) could view another church's fellowship attendance history by id. | Added a church-ownership check for admin roles. |
| 8 | `src/app/api/fellowship/validate-attendance/route.ts` | PATCH (approve/reject a monthly attendance record) took `id` from the body and patched it with **zero ownership check** — any authenticated user could validate/reject another fellowship's, or another church's, record by id. | Added a check that the record's cell belongs to the caller's own church (and fellowship, for non-admin roles) before allowing the update. |
| 9 | `src/app/api/meeting-requests/route.ts` | POST accepted a client-supplied `requested_of` user id with no check it belonged to the caller's own church — cross-tenant messaging/spam vector (a user in Church A could target any user id in Church B). | Added a check that `requested_of` belongs to the caller's own church before creating the request/notification. |
| 10 | `src/app/api/members/create/route.ts` | Two bugs: (a) the new `members` row was inserted with **no `church_id`** at all, making it invisible to every scoped query; (b) `cell_id`/`fellowship_id`/`department_id` were taken from the client with no ownership check. | Set `church_id: user.church_id` on the insert; added ownership checks for `cell_id`/`fellowship_id`/`department_id` against the caller's own church before use. |
| 11 | `src/app/api/partnership/giving/route.ts` | POST accepted a client-supplied `partner_id` with no check it belonged to the caller's own church. | Added a church-ownership check on `partner_id` before insert. |
| 12 | `src/app/api/partnership/partners/route.ts` | POST accepted a client-supplied `band_id` with no check it belonged to the caller's own church. | Added a church-ownership check on `band_id` (when provided) before insert. |
| 13 | `src/app/api/service-planner/items/route.ts` | GET listed `service_plan_items` by client-supplied `plan_id`/`assigned_to` with **no church check at all** (explicitly called out in-code as a "KNOWN GAP") — a guessed/leaked `plan_id` from another church could be read. | Added a church-ownership check on `plan_id` before listing (matching the sibling PATCH's existing pattern); pinned `assigned_to` to the caller's own id so it can never be used to read another user's items. |
| 14 | `src/app/api/update/member-removals/route.ts` | Two bugs, both explicitly called out in-code as an accepted "needs a schema change" gap: (a) admin GET listed **every church's** removal recommendations (no `church_id` on the table); (b) PATCH (approve/reject/revoke) had no ownership check on the record at all. | Applied the same transitive-scoping technique already used by `member_additions` (`recommended_by` → `users.church_id`) to both the admin GET listing and the PATCH ownership check — no schema change needed after all. |

## Flagged, not fixed (1)

- **`src/app/api/settings/route.ts`** — reads `church_settings?select=key,value` with no `church_id`
  filter at all. However: (a) there is **no caller anywhere in the frontend** for this endpoint (only
  its sibling `/api/settings/church-config` is used, everywhere), and (b) there is **no
  `church_settings` table defined in any tracked migration** under `scripts/` or in the schema
  snapshot in the scratchpad — I could not confirm whether this table even still exists, or whether
  it has a `church_id` column to filter by. Per the audit's own instruction not to guess against an
  unconfirmed schema, I did not blindly add a `church_id` filter (which would 400 if the column
  doesn't exist) or remove the route. **Recommend the team either delete this dead route or confirm
  the table's real schema and scope it properly** — it is reachable by any authenticated user
  regardless of church today.

## Notes / judgment calls (no code change)

- **`src/app/api/ai/query/route.ts`** (Moshe/LLM SQL agent) enforces church scoping via a
  string-containment check (`sql.includes(user.church_id)`) rather than a real SQL parser — a known,
  documented, pre-existing tradeoff (the code comment notes it closed off a prior total absence of
  any tenant check). Rewriting this into a real query-rewriter is a larger design change than a
  scoping-consistency fix and was left alone.
- **`src/app/api/cells/all/route.ts`** fetches `attendance_records`/`attendance_disputes`/
  `cell_meetings` without a `church_id` filter, but every downstream lookup keys strictly by this
  church's own cell UUIDs (fetched separately, already scoped) — cross-church collision would require
  a UUID collision, so this is an efficiency issue (fetches more rows than needed), not a data leak.
  Left unchanged per "don't touch unrelated code."
- **`src/app/api/care/trigger-midweek-alerts/route.ts`** fetches all `attendance_entries` globally
  then filters in-memory to this church's own `service_id`s — same shape as above, inefficient but not
  a leak (nothing unscoped reaches the response). Left unchanged.
- **`src/app/api/workforce/rosters/route.ts`** POST lets any `department_head` create/publish a
  roster (and send notifications) for **any department in their own church**, not just the one
  they head — this is a same-tenant authorization gap, not a multi-tenant scoping bug (the task's
  focus), so it was left alone; worth a follow-up ticket.
- **`src/app/api/cells/route.ts`** has a pre-existing, explicitly documented "KNOWN MULTI-TENANT GAP"
  for anonymous self-registration requests (no way to resolve which church an anonymous request
  belongs to without a church-slug URL scheme that doesn't exist yet). Left as documented — inventing
  a new URL scheme is out of scope for a scoping-consistency pass.
- **`src/app/api/admin/churches/route.ts`** and **`src/app/api/admin/alerts/route.ts`** are
  legitimately cross-church by design (platform-admin panels, gated to `lead_tech` only) — confirmed
  intentional, not the `church_config.id` vs `churches.id` confusion bug described in the brief.

## Typecheck

`npx tsc --noEmit` run after all fixes — see commit history for result.
