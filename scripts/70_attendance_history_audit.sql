-- SHEP.HERD — #33 follow-up: is the June 3 batch's attendance history real
-- or synthetic, and is any of it still sitting under a now-real cell?
--
-- What 68's Part 1 found: ~30 cells created in the same batch-minute as
-- the confirmed-synthetic member import (2026-06-03 22:08:51) each show
-- ~566 attendance_records rows — near-identical across totally different
-- cells, including "Men's Fellowship" (d670b4d2-3e1f-4cfb-b246-e5ac83920e7b),
-- which scripts/16_cleanse_seed_data.sql Part 8 already confirmed is REAL
-- (your 29 actual members). attendance_records is one row per cell per
-- service submission (present_count/absent_count/submitted_at, joined to
-- services) — so 566 of them isn't "566 members," it's 566 separate
-- submitted services, which is years of weekly attendance for a product
-- that's only been live since mid-2026. That number repeating almost
-- identically across ~30 unrelated cells is the same batch-seeding
-- signature as the confirmed-fake 1,147-row member batch, just for
-- attendance instead of members.
--
-- This does NOT recommend deleting anything yet — it's purely diagnostic,
-- same as 68. The point is to see exactly how far back the fake dates go,
-- and specifically whether Men's Fellowship's real current numbers are
-- being distorted by fake historical rows sitting underneath it.

-- ── PART 1: date range + batch clustering of attendance_records for
--    every June-3-batch cell, ordered so Men's Fellowship is easy to spot
-- ────────────────────────────────────────────────────────────────────────
SELECT
  c.name AS cell_name,
  c.id AS cell_id,
  count(ar.id) AS attendance_record_count,
  min(s.service_date) AS earliest_service_date,
  max(s.service_date) AS latest_service_date,
  count(DISTINCT date_trunc('minute', ar.submitted_at)) AS distinct_submission_minutes,
  -- if hundreds of records were submitted within a handful of clock
  -- minutes, that's the same "batch, not organic" signature as before
  min(ar.submitted_at) AS earliest_submitted_at,
  max(ar.submitted_at) AS latest_submitted_at
FROM cells c
JOIN attendance_records ar ON ar.cell_id = c.id
LEFT JOIN services s ON s.id = ar.service_id
WHERE c.created_at >= '2026-06-03 22:08:00+00' AND c.created_at < '2026-06-03 22:09:00+00'
GROUP BY c.id, c.name
ORDER BY (c.name = 'Men''s Fellowship') DESC, attendance_record_count DESC;

-- ── PART 2: Men's Fellowship specifically — the one cell where getting
--    this wrong has a real consequence, since it holds your real 29
--    members today. Full detail on every attendance_records row it has,
--    so you can see exactly which service_dates are fake vs (if any) real
-- ────────────────────────────────────────────────────────────────────────
SELECT
  ar.id, ar.submitted_at, s.service_date, ar.present_count, ar.absent_count,
  ar.visitor_count, ar.sla_grade
FROM attendance_records ar
LEFT JOIN services s ON s.id = ar.service_id
WHERE ar.cell_id = 'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b'
ORDER BY ar.submitted_at DESC
LIMIT 20;

-- Same as above, but the oldest 20 instead of newest — if the batch
-- signature holds, this should show a wall of records all submitted
-- within the same few minutes, far predating your real July 22 import.
SELECT
  ar.id, ar.submitted_at, s.service_date, ar.present_count, ar.absent_count,
  ar.visitor_count, ar.sla_grade
FROM attendance_records ar
LEFT JOIN services s ON s.id = ar.service_id
WHERE ar.cell_id = 'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b'
ORDER BY ar.submitted_at ASC
LIMIT 20;
