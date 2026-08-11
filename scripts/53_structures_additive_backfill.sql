-- ============================================================
-- Phase 3, Step 1 of 4 — additive backfill into a unified `structures`
-- table. Full design/rationale: PHASE_3_STRUCTURE_MIGRATION.md at repo
-- root — read that first, this file assumes you have.
--
-- SAFETY: this script only CREATEs a new table and copies rows into it.
-- It does not ALTER, rename, or DROP anything that exists today, and
-- nothing in the running app reads from or writes to `structures` yet —
-- Steps 2-4 (app dual-write, read cutover, legacy retirement) are
-- deliberately NOT included here; see the design doc for why.
--
-- Rollback, if anything here looks wrong after you review the
-- verification queries at the bottom: `DROP TABLE IF EXISTS structures;`
-- — nothing else references it, so nothing else can break.
-- ============================================================


-- ------------------------------------------------------------
-- PRE-FLIGHT — run this block FIRST, on its own, and read the output
-- before running anything below. It lists the real columns on cells,
-- fellowships, and departments in YOUR database right now. The backfill
-- below was written from column names confirmed by reading this app's
-- actual API route code (cells/create, admin/departments/create,
-- 23_cydf_generalize.sql, 25_branches.sql, 42_multi_tenant_churches.sql)
-- — not guessed — but it was written without the ability to connect to
-- this database directly, so confirming against the real thing first
-- costs you thirty seconds and removes all doubt.
-- ------------------------------------------------------------

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('cells', 'fellowships', 'departments')
ORDER BY table_name, ordinal_position;

-- Expect to see at minimum, on each table: id, name, church_id, branch_id.
-- Additionally on cells: fellowship_id, target_size, is_active.
-- Additionally on fellowships: is_aggregate_only.
-- If any of those are missing or named differently from what's listed
-- here, STOP and tell me what the real columns are before running the
-- CREATE TABLE / INSERT statements below — they reference these exact
-- names.

-- Also run this: `structures` has a UNIQUE (church_id, structure_type,
-- name) constraint (this is in fact the exact bug class fixed in
-- scripts/52 for branches — worth checking it isn't already present
-- here too). If this returns any rows, the INSERT below will fail with a
-- constraint violation on that row (a hard error, not silent data loss —
-- but better to know now than mid-run). Duplicates would need cleaning
-- up, or the constraint relaxed, before Step 1b runs.
SELECT church_id, name, count(*) FROM fellowships GROUP BY church_id, name HAVING count(*) > 1
UNION ALL
SELECT church_id, name, count(*) FROM departments GROUP BY church_id, name HAVING count(*) > 1
UNION ALL
SELECT church_id, name, count(*) FROM cells GROUP BY church_id, name HAVING count(*) > 1;


-- ------------------------------------------------------------
-- STEP 1a — create the table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS structures (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id            UUID NOT NULL REFERENCES churches(id),
  branch_id            UUID REFERENCES branches(id),
  structure_type       TEXT NOT NULL CHECK (structure_type IN ('cell', 'fellowship', 'department')),
  parent_structure_id  UUID REFERENCES structures(id),
  name                 TEXT NOT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT true,

  -- Type-specific, nullable, meaningful only for their type.
  target_size          INT,
  is_aggregate_only    BOOLEAN DEFAULT false,

  -- Provenance — every row traces back to exactly the legacy row it came
  -- from. This is what makes this script a copy, not a move.
  legacy_table         TEXT NOT NULL CHECK (legacy_table IN ('cells', 'fellowships', 'departments')),
  legacy_id            UUID NOT NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (church_id, structure_type, name),
  UNIQUE (legacy_table, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_structures_church ON structures(church_id);
CREATE INDEX IF NOT EXISTS idx_structures_type ON structures(structure_type);
CREATE INDEX IF NOT EXISTS idx_structures_parent ON structures(parent_structure_id);
CREATE INDEX IF NOT EXISTS idx_structures_legacy ON structures(legacy_table, legacy_id);


-- ------------------------------------------------------------
-- STEP 1b — backfill fellowships and departments first (cells reference
-- fellowships via parent_structure_id, so fellowships must exist in
-- `structures` before cells are inserted).
-- ------------------------------------------------------------

INSERT INTO structures (church_id, branch_id, structure_type, name, is_aggregate_only, legacy_table, legacy_id)
SELECT f.church_id, f.branch_id, 'fellowship', f.name, COALESCE(f.is_aggregate_only, false), 'fellowships', f.id
FROM fellowships f
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;

INSERT INTO structures (church_id, branch_id, structure_type, name, legacy_table, legacy_id)
SELECT d.church_id, d.branch_id, 'department', d.name, 'departments', d.id
FROM departments d
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;

INSERT INTO structures (church_id, branch_id, structure_type, name, is_active, target_size, parent_structure_id, legacy_table, legacy_id)
SELECT
  c.church_id,
  c.branch_id,
  'cell',
  c.name,
  COALESCE(c.is_active, true),
  c.target_size,
  (SELECT s.id FROM structures s WHERE s.legacy_table = 'fellowships' AND s.legacy_id = c.fellowship_id),
  'cells',
  c.id
FROM cells c
ON CONFLICT (legacy_table, legacy_id) DO NOTHING;


-- ------------------------------------------------------------
-- STEP 1c — verification. Run all of these and check every one before
-- considering this step done. Every query should return what its comment
-- says; if any doesn't, do not proceed to Step 2 — tell me what you see.
-- ------------------------------------------------------------

-- Row-count parity: each pair should match exactly.
SELECT 'fellowships' AS legacy, (SELECT count(*) FROM fellowships) AS legacy_count, (SELECT count(*) FROM structures WHERE structure_type = 'fellowship') AS structures_count
UNION ALL
SELECT 'departments', (SELECT count(*) FROM departments), (SELECT count(*) FROM structures WHERE structure_type = 'department')
UNION ALL
SELECT 'cells', (SELECT count(*) FROM cells), (SELECT count(*) FROM structures WHERE structure_type = 'cell');

-- Should return 0 rows — every structures row must have a church_id.
SELECT * FROM structures WHERE church_id IS NULL;

-- Should return 0 rows — every cell that had a fellowship_id should have
-- successfully resolved a parent_structure_id. A non-empty result here
-- means some cell's fellowship_id pointed at a fellowship that either
-- doesn't exist or wasn't backfilled — investigate before proceeding.
SELECT c.id, c.name, c.fellowship_id
FROM cells c
WHERE c.fellowship_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM structures s
    WHERE s.legacy_table = 'cells' AND s.legacy_id = c.id AND s.parent_structure_id IS NOT NULL
  );

-- Spot-check: pick 5 real rows and eyeball them against their legacy source.
SELECT s.structure_type, s.name, s.church_id, s.branch_id, s.parent_structure_id, s.legacy_table, s.legacy_id
FROM structures s
ORDER BY random()
LIMIT 5;
