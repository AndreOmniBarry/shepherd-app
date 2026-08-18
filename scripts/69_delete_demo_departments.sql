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

-- ── PRE-FLIGHT — run first, alone. Every count below should read 0.
-- If anything is non-zero, stop and paste the output back before running
-- PART 2 — that means one of these ids picked up a reference 68's audit
-- didn't check for, and the DELETE will fail closed (foreign key) rather
-- than silently orphan data, but worth knowing why before forcing it.
WITH demo_dept_ids AS (
  SELECT unnest(ARRAY[
    'ab93ae77-ab71-440c-9479-9b15e16f3f7e', -- Church Administration
    'f62453b0-cc58-4c6a-a0f2-657eceec8c94', -- Greeters
    '37348cf4-39a3-4524-a1f7-e26e88b2167f', -- Sanctuary Keepers
    '1884b88b-85a6-4eb4-8fee-d236dfab9478', -- Security & Maintenance
    '35480265-af54-43f2-99a1-d17ab32bd1f3', -- Sound Engineers
    'bc3014c6-bdbc-414c-af9b-e4f1fc7a9eaa', -- Teachers & Educators
    '5ffe237c-06ed-455f-8d13-599ef24f280a'  -- Traffic Control
  ]::uuid[]) AS id
)
SELECT
  (SELECT count(*) FROM demo_dept_ids) AS departments_to_delete,
  (SELECT count(*) FROM department_members WHERE department_id IN (SELECT id FROM demo_dept_ids)) AS department_members_rows,
  (SELECT count(*) FROM users WHERE department_id IN (SELECT id FROM demo_dept_ids)) AS user_rows,
  -- department_id lives on department_attendance (one row per
  -- service+department) — department_attendance_entries only has
  -- record_id/member_id, no department_id of its own, which is what
  -- broke the first version of this query.
  (SELECT count(*) FROM department_attendance WHERE department_id IN (SELECT id FROM demo_dept_ids)) AS attendance_record_rows,
  (SELECT count(*) FROM workforce_profiles WHERE primary_department_id IN (SELECT id FROM demo_dept_ids)) AS workforce_profile_rows,
  -- Missing from the first version entirely — confirmed real via
  -- scripts/34_merge_choir_into_music.sql, the repo's own proven pattern
  -- for a department merge/delete.
  (SELECT count(*) FROM workforce_rosters WHERE department_id IN (SELECT id FROM demo_dept_ids)) AS workforce_roster_rows,
  (SELECT count(*) FROM member_additions WHERE department_id IN (SELECT id FROM demo_dept_ids)) AS pending_import_rows,
  (SELECT count(*) FROM invites WHERE department_id IN (SELECT id FROM demo_dept_ids) AND used = false) AS unused_invite_rows;

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
