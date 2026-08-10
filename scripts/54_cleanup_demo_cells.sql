-- ============================================================
-- Remove demo/seed cells and their fake attendance history from the
-- live `cells` table, per founder confirmation: the system hasn't gone
-- live yet, demo data was fed in for structure while building, and the
-- only real records are from the original church-data import plus a
-- few additions on top of it (the "Group 1"-"Group 6" cells and "Men's
-- Fellowship" — which should be run through the Men Cell merge FIRST,
-- see the app's "Merge cells" tool, before this script runs).
--
-- Real cells are identified by an explicit allow-list of 7 ids (below),
-- not by any heuristic — the delete target is "everything NOT in this
-- list," so there's no risk of a typo'd id silently keeping a demo cell
-- around, and no risk of a wrong guess deleting a real one.
--
-- Deletes attendance_records and cell_meetings tied to those cells first
-- (children before parent, explicit, not relying on assumed cascade
-- behavior), sets first_timers.cell_id to NULL for any pointing at a
-- deleted cell (preserving the first-timer record itself, only clearing
-- the dangling reference), then deletes the cells themselves. All in one
-- transaction — either the whole cleanup applies, or none of it does.
-- ============================================================

-- ------------------------------------------------------------
-- PRE-FLIGHT — run first, alone. Shows exactly what's about to be
-- deleted before anything is touched.
-- ------------------------------------------------------------

WITH real_cells AS (
  SELECT unnest(ARRAY[
    '30734330-3155-44f8-9f01-ee7c27344c77', -- Group 1
    'f05461a6-3545-4c4c-a5e8-c6f75765ea2e', -- Group 2
    '283772ff-60cb-43c7-bdb3-cfffed6a27c8', -- Group 3
    'f4ca9a12-99fe-4b27-a3ee-1bb24e597ada', -- Group 4
    'e4d422ed-a9c9-4c3b-ae3f-090084fadd42', -- Group 5
    'dccdadfd-1133-4723-9304-1afd61b11852', -- Group 6
    'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b'  -- Men's Fellowship
  ]::uuid[]) AS id
)
SELECT
  (SELECT count(*) FROM cells WHERE id NOT IN (SELECT id FROM real_cells)) AS cells_to_delete,
  (SELECT count(*) FROM attendance_records WHERE cell_id NOT IN (SELECT id FROM real_cells)) AS attendance_records_to_delete,
  (SELECT count(*) FROM cell_meetings WHERE cell_id NOT IN (SELECT id FROM real_cells)) AS meeting_logs_to_delete,
  (SELECT count(*) FROM first_timers WHERE cell_id NOT IN (SELECT id FROM real_cells)) AS first_timers_to_unlink,
  -- Sanity check: should be 7. If it's not, one of the 7 ids above no
  -- longer matches a real row (e.g. the Men Cell merge changed an id,
  -- which it shouldn't, but check anyway before proceeding).
  (SELECT count(*) FROM cells WHERE id IN (SELECT id FROM real_cells)) AS real_cells_confirmed_present;

-- Expect: cells_to_delete = 56, real_cells_confirmed_present = 7.
-- If real_cells_confirmed_present isn't 7, STOP — one of the 7 ids
-- didn't match, and the delete below would be too aggressive.


-- ------------------------------------------------------------
-- CLEANUP — run after the pre-flight looks right.
-- ------------------------------------------------------------

BEGIN;

WITH real_cells AS (
  SELECT unnest(ARRAY[
    '30734330-3155-44f8-9f01-ee7c27344c77',
    'f05461a6-3545-4c4c-a5e8-c6f75765ea2e',
    '283772ff-60cb-43c7-bdb3-cfffed6a27c8',
    'f4ca9a12-99fe-4b27-a3ee-1bb24e597ada',
    'e4d422ed-a9c9-4c3b-ae3f-090084fadd42',
    'dccdadfd-1133-4723-9304-1afd61b11852',
    'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b'
  ]::uuid[]) AS id
)
DELETE FROM attendance_records WHERE cell_id NOT IN (SELECT id FROM real_cells);

WITH real_cells AS (
  SELECT unnest(ARRAY[
    '30734330-3155-44f8-9f01-ee7c27344c77',
    'f05461a6-3545-4c4c-a5e8-c6f75765ea2e',
    '283772ff-60cb-43c7-bdb3-cfffed6a27c8',
    'f4ca9a12-99fe-4b27-a3ee-1bb24e597ada',
    'e4d422ed-a9c9-4c3b-ae3f-090084fadd42',
    'dccdadfd-1133-4723-9304-1afd61b11852',
    'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b'
  ]::uuid[]) AS id
)
DELETE FROM cell_meetings WHERE cell_id NOT IN (SELECT id FROM real_cells);

WITH real_cells AS (
  SELECT unnest(ARRAY[
    '30734330-3155-44f8-9f01-ee7c27344c77',
    'f05461a6-3545-4c4c-a5e8-c6f75765ea2e',
    '283772ff-60cb-43c7-bdb3-cfffed6a27c8',
    'f4ca9a12-99fe-4b27-a3ee-1bb24e597ada',
    'e4d422ed-a9c9-4c3b-ae3f-090084fadd42',
    'dccdadfd-1133-4723-9304-1afd61b11852',
    'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b'
  ]::uuid[]) AS id
)
UPDATE first_timers SET cell_id = NULL WHERE cell_id NOT IN (SELECT id FROM real_cells);

WITH real_cells AS (
  SELECT unnest(ARRAY[
    '30734330-3155-44f8-9f01-ee7c27344c77',
    'f05461a6-3545-4c4c-a5e8-c6f75765ea2e',
    '283772ff-60cb-43c7-bdb3-cfffed6a27c8',
    'f4ca9a12-99fe-4b27-a3ee-1bb24e597ada',
    'e4d422ed-a9c9-4c3b-ae3f-090084fadd42',
    'dccdadfd-1133-4723-9304-1afd61b11852',
    'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b'
  ]::uuid[]) AS id
)
DELETE FROM cells WHERE id NOT IN (SELECT id FROM real_cells);

COMMIT;

-- ------------------------------------------------------------
-- VERIFICATION — run after commit.
-- ------------------------------------------------------------

SELECT count(*) AS remaining_cells FROM cells; -- expect 7
SELECT id, name, member_count FROM cells ORDER BY name; -- eyeball: should be exactly the 7 real ones, Men's Fellowship (or already renamed "Men Cell") should show ~75 if the merge ran first
