# Phase 3 — Unified `structures` Table

Status: **DESIGN + STEP 1 SCRIPT ONLY. NOT RUN. NOT APPLIED TO PRODUCTION.**
This is written for the founder to review and run by hand — no AI agent has executed
any of this against the live database, and no agent should, without a fresh, explicit
go-ahead per step. Production data is real church data; this plan is built assuming
that fact throughout.

## Correction to the original scope

Phases 1 and 2 unified `cell`/`fellowship`/`department` because they're genuinely the
same kind of thing — ministry units in a parent/child tree, each tracking attendance —
while deliberately leaving alone things that only *looked* similar but weren't (e.g.
department's roster join table, fellowship's finance rollups). This phase applies the
same judgment to itself: the original plan said "cells/fellowships/departments/**branches**
into one structures table." On inspection, branches don't belong in that union.

A branch is a physical *location*. It's referenced — as a plain foreign key — by
members, cells, fellowships, departments, users, events, services, income records, and
expense requisitions. It is not a node in the cell→fellowship ministry tree; it's
metadata those nodes carry. Folding it into `structures` alongside cell/fellowship/
department would either force a `parent_structure_id` relationship that doesn't
exist (a branch isn't "under" a fellowship) or leave it structurally inert inside a
table built for a different shape. So: **`structures` = cell + fellowship + department
only.** `branches` stays exactly as it is, including the per-church uniqueness fix
already shipped (`scripts/52_branches_church_scoped_unique_name.sql`).

## Target schema

```sql
CREATE TABLE structures (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id            UUID NOT NULL REFERENCES churches(id),
  branch_id            UUID REFERENCES branches(id),
  structure_type       TEXT NOT NULL CHECK (structure_type IN ('cell','fellowship','department')),
  parent_structure_id  UUID REFERENCES structures(id),   -- a cell's parent is its fellowship; fellowship/department have none today
  name                 TEXT NOT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT true,

  -- Type-specific fields. Nullable, meaningful only for their type — same
  -- "don't fake parity" principle Phase 1 used for StructureOverview's
  -- optional fields (bestSunday/worstSunday/warningCount).
  target_size          INT,               -- cell only
  is_aggregate_only     BOOLEAN DEFAULT false, -- fellowship only (see 23_cydf_generalize.sql)

  -- Provenance — every row traces back to exactly the legacy row it came
  -- from. This is what makes Step 1 safe: it's a labeled copy, not a move.
  legacy_table         TEXT NOT NULL CHECK (legacy_table IN ('cells','fellowships','departments')),
  legacy_id            UUID NOT NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (church_id, structure_type, name),
  UNIQUE (legacy_table, legacy_id)
);
```

`department_members` (department's many-to-many roster with a per-member role) and
`members.cell_id`/`members.fellowship_id` (single-valued FKs) are **not** touched or
unified by this table. Those are a real, pre-existing schema asymmetry between how
cell/fellowship membership works versus department membership — Phase 2's own report
flagged this as something that shouldn't be forced together. This migration doesn't
attempt to fix that; it's a separate, larger question or a separate task (#26's report:
"cells/members vs department/members... forcing these together would either fabricate
a cell roster mutation API that doesn't exist, or flatten the department join-table
model").

## The staged plan — four steps, each independently safe to stop after

### Step 1 — Additive backfill. Safe to run today, in production, with zero app changes. ✅ SCRIPT READY BELOW

Creates `structures`, copies every existing cell/fellowship/department row into it with
full provenance. Nothing reads from or writes to this table yet — the running app is
completely unaffected. If anything about it looks wrong, the rollback is one line:
`DROP TABLE structures;` — nothing else references it, so nothing else can break.

**This is the only step included as an executable script in this pass.** Steps 2–4
are described below so you have the full shape of the plan, but writing them as
ready-to-run code now would be premature — they depend on how Step 1's backfill
actually looks against your real data, which I can't see from this environment.

### Step 2 — App-level dual-write (not written yet; needs its own pass)

Every route that creates or updates a cell/fellowship/department also writes the
matching `structures` row. Phase 2 already collapsed the shared logic for
history/overview into `src/lib/structure-history.ts` and `src/lib/structure-overview.ts`
— the create/update routes (`cells/create`, `admin/departments/create`, and whatever
handles fellowship creation) are the natural, small set of touchpoints for this, since
they're the only places these rows are ever written. Runs alongside Step 1's table for
a soak period — days to weeks, your call — with a verification query (row counts and a
checksum of name/church_id/type per legacy table vs. `structures`) run periodically to
confirm they never drift apart.

### Step 3 — Read cutover, one route at a time (not written yet)

Only after Step 2 has run cleanly for a real soak period: migrate routes to *read* from
`structures` instead of the legacy tables, starting with the lowest-risk, best-tested
ones (the Phase 1/2 shared code is the natural starting point, since it's the newest
and most recently verified). One route, verify, next route — not a cutover in one
commit.

### Step 4 — Retire the legacy tables (not written yet, and not urgent)

Only after every read and write goes through `structures` with no incidents for a real
period of time. Even then: strongly consider renaming (`cells` → `cells_legacy_frozen`)
rather than dropping. There's no real cost to keeping them as a frozen audit trail, and
dropping is the one step in this entire plan that's genuinely irreversible.

## Step 1 script

See `scripts/53_structures_additive_backfill.sql`. Includes the `CREATE TABLE`, the
three backfill `INSERT`s (one per legacy table), and verification queries to run
immediately after — row-count parity between each legacy table and its `structures`
rows, and a check for any `NULL church_id` (should be impossible given the source
tables' own constraints, but worth confirming against real data rather than assuming).

## Rollback for Step 1

```sql
DROP TABLE IF EXISTS structures;
```
Nothing else in the schema references `structures` after Step 1, so this is
unconditionally safe — no cascade, no orphaned foreign keys, no app code touches it.

## What I need from you before Step 1 runs

Nothing beyond reviewing the script. It's additive and non-destructive by construction
— but "I designed it not to be destructive" is a claim, not a guarantee, until it's
actually run against your real data and the verification queries at the bottom of the
script come back clean. Run it, run the verification block, and tell me what it
returns before we talk about Step 2.
