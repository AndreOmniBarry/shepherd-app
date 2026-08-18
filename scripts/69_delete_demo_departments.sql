-- SHEP.HERD — #33 follow-up: delete the 7 confirmed-demo departments
-- surfaced by scripts/68_cell_data_audit.sql's Part 4.
--
-- These 7 all share the exact same creation timestamp
-- (2026-06-03 20:39:39.813971+00) — a batch, not organic one-by-one
-- creation — and 68's own query already confirmed zero department_members
-- and zero assigned users for every one of them. "Lighting Department" was
-- excluded: it shares its batch-minute with your confirmed-real Grace
-- Dome import (2026-07-22 19:06), so it almost certainly came in with your
-- real data as a genuinely empty department, not demo debris — it is NOT
-- touched by this script.
--
-- Departments have no is_active flag to soft-disable like cells do (see
-- script 16 Part 11's note), so this is a hard delete. Confirmed by you
-- to proceed; re-creating any of these later, for real, is a two-minute
-- "Create Department" action if the church ever needs one.

-- ── PRE-FLIGHT — run first, alone. Every row's count should read 0.
-- If anything is non-zero, stop and paste the output back before running
-- PART 2 — that means one of these ids picked up a reference 68's audit
-- didn't check for, and the DELETE will fail closed (foreign key) rather
-- than silently orphan data, but worth knowing why before forcing it.
--
-- Two earlier versions of this query guessed a column name from this
-- repo's .sql files (department_attendance_entries.department_id, then
-- member_additions.department_id) and both turned out not to exist on the
-- live database — scripts/16_cleanse_seed_data.sql's own comments already
-- document scripts/13_member_extra_columns.sql partially failing to apply
-- here, which is almost certainly why. Rather than guess a third time,
-- this checks information_schema for each column before ever querying it,
-- and reports "column not found — skipped" instead of erroring when one
-- genuinely isn't there.
DROP TABLE IF EXISTS _preflight_69;
CREATE TEMP TABLE _preflight_69 (check_name TEXT, row_count BIGINT);

DO $$
DECLARE
  demo_ids UUID[] := ARRAY[
    'ab93ae77-ab71-440c-9479-9b15e16f3f7e', -- Church Administration
    'f62453b0-cc58-4c6a-a0f2-657eceec8c94', -- Greeters
    '37348cf4-39a3-4524-a1f7-e26e88b2167f', -- Sanctuary Keepers
    '1884b88b-85a6-4eb4-8fee-d236dfab9478', -- Security & Maintenance
    '35480265-af54-43f2-99a1-d17ab32bd1f3', -- Sound Engineers
    'bc3014c6-bdbc-414c-af9b-e4f1fc7a9eaa', -- Teachers & Educators
    '5ffe237c-06ed-455f-8d13-599ef24f280a'  -- Traffic Control
  ];
  chk RECORD;
  cnt BIGINT;
BEGIN
  INSERT INTO _preflight_69 VALUES ('departments_to_delete', array_length(demo_ids, 1));

  FOR chk IN
    SELECT * FROM (VALUES
      ('department_members', 'department_id'),
      ('users', 'department_id'),
      ('department_attendance', 'department_id'),
      ('workforce_profiles', 'primary_department_id'),
      ('workforce_rosters', 'department_id'),
      ('member_additions', 'department_id'),
      ('invites', 'department_id')
    ) AS t(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = chk.table_name AND column_name = chk.column_name
    ) THEN
      EXECUTE format('SELECT count(*) FROM %I WHERE %I = ANY($1)', chk.table_name, chk.column_name)
        INTO cnt USING demo_ids;
      INSERT INTO _preflight_69 VALUES (chk.table_name || '.' || chk.column_name, cnt);
    ELSE
      INSERT INTO _preflight_69 VALUES (chk.table_name || '.' || chk.column_name || ' (column not found — skipped)', NULL);
    END IF;
  END LOOP;
END $$;

SELECT * FROM _preflight_69 ORDER BY check_name;

-- ── PART 2 — only run once every count above reads 0 ─────────────────────
BEGIN;

WITH demo_dept_ids AS (
  SELECT unnest(ARRAY[
    'ab93ae77-ab71-440c-9479-9b15e16f3f7e',
    'f62453b0-cc58-4c6a-a0f2-657eceec8c94',
    '37348cf4-39a3-4524-a1f7-e26e88b2167f',
    '1884b88b-85a6-4eb4-8fee-d236dfab9478',
    '35480265-af54-43f2-99a1-d17ab32bd1f3',
    'bc3014c6-bdbc-414c-af9b-e4f1fc7a9eaa',
    '5ffe237c-06ed-455f-8d13-599ef24f280a'
  ]::uuid[]) AS id
)
DELETE FROM departments WHERE id IN (SELECT id FROM demo_dept_ids);

COMMIT;

-- ── VERIFY — should show 0 rows (all 7 gone), Lighting Department
--    untouched and still present ───────────────────────────────────────
SELECT id, name, created_at FROM departments
WHERE id IN (
  'ab93ae77-ab71-440c-9479-9b15e16f3f7e', 'f62453b0-cc58-4c6a-a0f2-657eceec8c94',
  '37348cf4-39a3-4524-a1f7-e26e88b2167f', '1884b88b-85a6-4eb4-8fee-d236dfab9478',
  '35480265-af54-43f2-99a1-d17ab32bd1f3', 'bc3014c6-bdbc-414c-af9b-e4f1fc7a9eaa',
  '5ffe237c-06ed-455f-8d13-599ef24f280a'
);

SELECT id, name, created_at FROM departments WHERE name = 'Lighting Department';
