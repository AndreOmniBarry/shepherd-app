-- SHEP.HERD — #33 follow-up: what's left to check after 16_cleanse_seed_data.sql
--
-- DIAGNOSTIC ONLY. Nothing in this file deletes, updates, or inserts a
-- single row. It exists because scripts/54_cleanup_demo_cells.sql already
-- proved a heuristic ("no members = demo") isn't safe on its own — a real
-- cell can legitimately be empty (mid-reassignment, newly created, a leader
-- who hasn't run their first service yet). This script surfaces every
-- signal worth looking at side by side instead, so you can eyeball the
-- actual list before anything is ever deleted, the same way scripts 16 and
-- 33 already worked.
--
-- Confirmed before writing this: no application code path (API routes) or
-- SQL script other than 12_import_grace_dome_data.sql ever inserts into
-- cells/fellowships/departments — so whatever's left is one-time leftover
-- data, not a recurring seeding bug. This coding session also has no live
-- network path to the Supabase database, so I can't run this myself; run
-- each part below and share the output back and I'll turn whatever's
-- actually stray into an exact, reviewed delete list — same process as
-- script 16.

-- ── PART 1: every cell, with the signals that actually distinguish
--    "real, currently empty" from "leftover placeholder" ──────────────────
-- - member_count / attendance_history: a cell with real attendance history
--   is real, full stop, regardless of current member count.
-- - name pattern: flags cells whose name looks generated rather than
--   chosen by a leader (numbered placeholders, "Test", "Sample", "Demo",
--   "Cell N" with no other qualifier).
-- - created_at: the batch_minute clustering trick from script 16 — a
--   cell created in the same minute as dozens of others is almost
--   certainly from the 12_import_grace_dome_data.sql run, not hand-created.
SELECT
  c.id, c.name, c.is_active, c.created_at,
  (SELECT count(*) FROM members m WHERE m.cell_id = c.id) AS member_count,
  (SELECT count(*) FROM attendance_records ar WHERE ar.cell_id = c.id) AS attendance_records,
  (SELECT count(*) FROM cell_meetings cm WHERE cm.cell_id = c.id) AS meeting_logs,
  (SELECT count(*) FROM users u WHERE u.cell_id = c.id AND u.role = 'cell_leader' AND u.is_active) AS active_leader_accounts,
  (c.name ~* 'test|demo|sample|placeholder|^cell [0-9]+$|^unnamed') AS name_looks_generated,
  date_trunc('minute', c.created_at) AS batch_minute
FROM cells c
ORDER BY
  (SELECT count(*) FROM attendance_records ar WHERE ar.cell_id = c.id) ASC,  -- no history first — the actual review candidates
  c.created_at;

-- ── PART 2: batch-minute clustering across every structural table ───────
-- Same technique script 16 used to isolate the one big import cluster —
-- run this to see the current shape now that some of 16's cleanup has
-- already landed. Any batch_minute with a handful of rows outside the big
-- cluster(s) is worth a closer look via Part 1/3.
SELECT 'cells' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM cells GROUP BY 2 ORDER BY 3 DESC;

SELECT 'fellowships' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM fellowships GROUP BY 2 ORDER BY 3 DESC;

SELECT 'departments' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM departments GROUP BY 2 ORDER BY 3 DESC;

SELECT 'members' AS table_name, date_trunc('minute', created_at) AS batch_minute, count(*)
FROM members GROUP BY 2 ORDER BY 3 DESC;

-- ── PART 3: any remaining fixed-format demo/test accounts ───────────────
-- Same pattern as scripts/33_deactivate_demo_pastor.sql, run again in case
-- anything new has crept in since — WHERE clause only ever matches rows
-- whose name/email literally contains "demo" or "test", so it can't
-- accidentally flag a real person.
SELECT id, full_name, email, role, is_active, created_at
FROM users
WHERE email ILIKE '%demo%' OR full_name ILIKE '%demo%'
   OR email ILIKE '%test%' OR full_name ILIKE '%test%'
ORDER BY is_active DESC, created_at;

-- ── PART 4: fellowships/departments with zero cells AND zero members ────
-- The exact shape the Men's/Women's Fellowship duplicates had in script 16
-- before they were merged — a completely empty structural row is either a
-- genuine duplicate-name leftover or a church-structure change that never
-- got cleaned up after the fact.
SELECT f.id, f.name, f.created_at,
  (SELECT count(*) FROM cells c WHERE c.fellowship_id = f.id) AS cell_count,
  (SELECT count(*) FROM members m WHERE m.fellowship_id = f.id) AS member_count
FROM fellowships f
WHERE NOT EXISTS (SELECT 1 FROM cells c WHERE c.fellowship_id = f.id)
  AND NOT EXISTS (SELECT 1 FROM members m WHERE m.fellowship_id = f.id)
ORDER BY f.name;

SELECT d.id, d.name, d.created_at,
  (SELECT count(*) FROM department_members dm WHERE dm.department_id = d.id) AS member_count,
  (SELECT count(*) FROM users u WHERE u.department_id = d.id) AS assigned_accounts
FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM department_members dm WHERE dm.department_id = d.id)
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.department_id = d.id)
ORDER BY d.name;
