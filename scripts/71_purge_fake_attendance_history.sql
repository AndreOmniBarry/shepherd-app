-- SHEP.HERD — #33: purge the fabricated attendance_records batch
-- confirmed by scripts/70_attendance_history_audit.sql.
--
-- 33 of 34 cells in the June-3 batch share an identical fake signature:
-- service_date running 2021-01-03 → 2026-05-31 (this product didn't exist
-- in 2021), every sla_grade a flat 'A', present_count + absent_count a
-- constant 19 on every row, and every submitted_at clustered in the
-- early-morning hours of 2026-05-31 — one generator run that backfilled
-- ~5 years of fake weekly attendance in a single sitting, then stopped.
--
-- This is confirmed still corrupting real data today: "Men's Fellowship"
-- (d670b4d2-...) holds your real 29 members (scripts/16 Part 8) but its
-- SLA grade and attendance trend are currently computed off this same
-- fake block underneath them.
--
-- Cutoff: submitted_at < 2026-06-01. Every one of the 33 cells' fake data
-- ends within hours of 2026-05-31 — nothing after. "Power House Cell" has
-- one extra row on 2026-07-17, after the fake batch and close to your
-- real July 22 import — this cutoff preserves it rather than guessing
-- whether it's real. "Glory House Cell" is excluded entirely — its 4 rows
-- (May 24-31, submitted June 6/12) don't match this pattern and aren't
-- touched by this script at all.
--
-- This only removes attendance_records rows — it does not touch the
-- cells themselves, their members, or their names. Whether to also remove
-- the ~31 now-still-empty cell shells underneath this fake history is a
-- separate decision (see the note at the bottom); this script is scoped
-- to just the confirmed-fake historical numbers.

-- ── PRE-FLIGHT — run first, alone. ────────────────────────────────────
WITH batch_cell_ids AS (
  SELECT unnest(ARRAY[
    'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b', -- Men's Fellowship (real members, fake history)
    'ce4a4260-96bb-434f-b0ab-b73ff37d23d1', -- Power House Cell
    '15b989ab-8a3a-43c9-83ed-2548c0e0bf40', -- Burning Bush Cell
    '15da46b5-3594-40ed-9b07-3733b2341e94', -- Living Waters Cell
    '161121b5-7316-4e84-8ad4-c9ec0fb94e08', -- Restoration Cell
    '1768d6ab-9a04-49e9-a2c9-c2d64632f886', -- Breakthrough Cell
    '1809e172-81d9-4353-affc-d0179dae8730', -- Emmanuel Cell
    '252c8a3c-0125-408d-9bb7-ac646f291fbf', -- Eagles Cell
    '2da69a27-59c4-4ecb-8556-2ada5c7e7603', -- Fountain of Life Cell
    '33a90411-6c2f-4894-8e2d-a337704bae4f', -- Cornerstone Cell
    '48b6edf1-0103-4201-8a63-d8ca0e390ef3', -- Zion Cell
    '58014731-1548-4e2c-948d-b544c00517f4', -- Lighthouse Cell
    '5aab2a7e-824a-4b19-9cc3-756e04421df1', -- Dayspring Cell
    '675e8b93-8d38-4a5d-bb72-005a6b992cfb', -- Anchor Cell
    '6f6207ed-f40e-4c1e-901c-a0b5cf7a194a', -- Overflow Cell
    '7756b1b6-5c01-42f9-9482-3ea6d8924a5c', -- Harvest Cell
    '78eff7d0-cc81-4ac7-9042-5abe5471f4da', -- Jubilee Cell
    '7f4075c8-1a2f-44ec-9f86-f306b0e121d1', -- Achievers Cell
    '8010d467-ca62-4270-a107-29172834d7d1', -- Peace Cell
    '8338c2cc-db05-46fb-907d-5956bad09164', -- Graceland Cell
    '83a17c21-3a46-4ff5-9a8c-31abe49ef24c', -- Promised Land Cell
    '9045abdf-cef3-47de-b87a-7625d82d5bc0', -- New Dawn Cell
    '91c99a31-e61b-4f85-81d5-2585a87f634a', -- Solid Rock Cell
    '9b7ccd91-f004-4c2c-b18e-1c51346bc816', -- Fortress Cell
    'a0f31890-544e-4929-ae5b-4fa334d904b7', -- Victory Cell
    'a1176263-ae32-490a-b98e-49704996a979', -- Dominion Cell
    'a649c925-1274-4533-9a77-2ab1e53af364', -- Manifold Blessings Cell
    'b021e73c-0a60-4836-9d53-f94b30d04c5e', -- Tabernacle Cell
    'b2c11049-b866-4a8c-93b7-941262fefe96', -- Trumpet Cell
    'c8e3d0f1-e5a4-4a2e-965a-b20508ad4c98', -- Elevation Cell
    'f7611ce4-3fb3-48e4-8b5e-ef295253e4ff', -- Shalom Cell
    '062e1e85-f964-4a6e-be2e-3a6ec0c06d97', -- Champions Cell
    '00ad4abf-398a-4ced-8098-3f64503063dc', -- Rock of Ages Cell
    'f32111a1-d1ef-497d-aef4-ac7e25e4d427'  -- Kingdom Builders Cell
    -- Glory House Cell (0b4183fa-...) deliberately excluded — different
    -- shape entirely, doesn't match the fake pattern.
  ]::uuid[]) AS id
)
SELECT
  c.name,
  count(ar.id) AS rows_to_delete,
  min(ar.submitted_at) AS earliest,
  max(ar.submitted_at) AS latest,
  count(*) FILTER (WHERE ar.submitted_at >= '2026-06-01') AS rows_that_would_survive
FROM cells c
JOIN attendance_records ar ON ar.cell_id = c.id
WHERE c.id IN (SELECT id FROM batch_cell_ids)
GROUP BY c.id, c.name
ORDER BY c.name;
-- Expect: rows_that_would_survive = 0 for everything except Power House
-- Cell (1) — its July 17 row staying untouched is intentional.

-- ── DELETE — only after the pre-flight above looks right ─────────────
BEGIN;

WITH batch_cell_ids AS (
  SELECT unnest(ARRAY[
    'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b', 'ce4a4260-96bb-434f-b0ab-b73ff37d23d1',
    '15b989ab-8a3a-43c9-83ed-2548c0e0bf40', '15da46b5-3594-40ed-9b07-3733b2341e94',
    '161121b5-7316-4e84-8ad4-c9ec0fb94e08', '1768d6ab-9a04-49e9-a2c9-c2d64632f886',
    '1809e172-81d9-4353-affc-d0179dae8730', '252c8a3c-0125-408d-9bb7-ac646f291fbf',
    '2da69a27-59c4-4ecb-8556-2ada5c7e7603', '33a90411-6c2f-4894-8e2d-a337704bae4f',
    '48b6edf1-0103-4201-8a63-d8ca0e390ef3', '58014731-1548-4e2c-948d-b544c00517f4',
    '5aab2a7e-824a-4b19-9cc3-756e04421df1', '675e8b93-8d38-4a5d-bb72-005a6b992cfb',
    '6f6207ed-f40e-4c1e-901c-a0b5cf7a194a', '7756b1b6-5c01-42f9-9482-3ea6d8924a5c',
    '78eff7d0-cc81-4ac7-9042-5abe5471f4da', '7f4075c8-1a2f-44ec-9f86-f306b0e121d1',
    '8010d467-ca62-4270-a107-29172834d7d1', '8338c2cc-db05-46fb-907d-5956bad09164',
    '83a17c21-3a46-4ff5-9a8c-31abe49ef24c', '9045abdf-cef3-47de-b87a-7625d82d5bc0',
    '91c99a31-e61b-4f85-81d5-2585a87f634a', '9b7ccd91-f004-4c2c-b18e-1c51346bc816',
    'a0f31890-544e-4929-ae5b-4fa334d904b7', 'a1176263-ae32-490a-b98e-49704996a979',
    'a649c925-1274-4533-9a77-2ab1e53af364', 'b021e73c-0a60-4836-9d53-f94b30d04c5e',
    'b2c11049-b866-4a8c-93b7-941262fefe96', 'c8e3d0f1-e5a4-4a2e-965a-b20508ad4c98',
    'f7611ce4-3fb3-48e4-8b5e-ef295253e4ff', '062e1e85-f964-4a6e-be2e-3a6ec0c06d97',
    '00ad4abf-398a-4ced-8098-3f64503063dc', 'f32111a1-d1ef-497d-aef4-ac7e25e4d427'
  ]::uuid[]) AS id
)
DELETE FROM attendance_records
WHERE cell_id IN (SELECT id FROM batch_cell_ids)
  AND submitted_at < '2026-06-01 00:00:00+00';

COMMIT;

-- ── VERIFY ─────────────────────────────────────────────────────────────
-- Should show only Power House Cell, with exactly 1 row (its July 17
-- submission) — everyone else should be gone from this list entirely.
WITH batch_cell_ids AS (
  SELECT unnest(ARRAY[
    'd670b4d2-3e1f-4cfb-b246-e5ac83920e7b', 'ce4a4260-96bb-434f-b0ab-b73ff37d23d1',
    '15b989ab-8a3a-43c9-83ed-2548c0e0bf40', '15da46b5-3594-40ed-9b07-3733b2341e94',
    '161121b5-7316-4e84-8ad4-c9ec0fb94e08', '1768d6ab-9a04-49e9-a2c9-c2d64632f886',
    '1809e172-81d9-4353-affc-d0179dae8730', '252c8a3c-0125-408d-9bb7-ac646f291fbf',
    '2da69a27-59c4-4ecb-8556-2ada5c7e7603', '33a90411-6c2f-4894-8e2d-a337704bae4f',
    '48b6edf1-0103-4201-8a63-d8ca0e390ef3', '58014731-1548-4e2c-948d-b544c00517f4',
    '5aab2a7e-824a-4b19-9cc3-756e04421df1', '675e8b93-8d38-4a5d-bb72-005a6b992cfb',
    '6f6207ed-f40e-4c1e-901c-a0b5cf7a194a', '7756b1b6-5c01-42f9-9482-3ea6d8924a5c',
    '78eff7d0-cc81-4ac7-9042-5abe5471f4da', '7f4075c8-1a2f-44ec-9f86-f306b0e121d1',
    '8010d467-ca62-4270-a107-29172834d7d1', '8338c2cc-db05-46fb-907d-5956bad09164',
    '83a17c21-3a46-4ff5-9a8c-31abe49ef24c', '9045abdf-cef3-47de-b87a-7625d82d5bc0',
    '91c99a31-e61b-4f85-81d5-2585a87f634a', '9b7ccd91-f004-4c2c-b18e-1c51346bc816',
    'a0f31890-544e-4929-ae5b-4fa334d904b7', 'a1176263-ae32-490a-b98e-49704996a979',
    'a649c925-1274-4533-9a77-2ab1e53af364', 'b021e73c-0a60-4836-9d53-f94b30d04c5e',
    'b2c11049-b866-4a8c-93b7-941262fefe96', 'c8e3d0f1-e5a4-4a2e-965a-b20508ad4c98',
    'f7611ce4-3fb3-48e4-8b5e-ef295253e4ff', '062e1e85-f964-4a6e-be2e-3a6ec0c06d97',
    '00ad4abf-398a-4ced-8098-3f64503063dc', 'f32111a1-d1ef-497d-aef4-ac7e25e4d427'
  ]::uuid[]) AS id
)
SELECT c.name, count(ar.id) AS remaining_rows, max(ar.submitted_at) AS latest
FROM cells c
JOIN attendance_records ar ON ar.cell_id = c.id
WHERE c.id IN (SELECT id FROM batch_cell_ids)
GROUP BY c.id, c.name
ORDER BY c.name;

-- ── NOTE — separate decision, not run by this script ─────────────────
-- With the fake attendance gone, most of these 33 cells go back to being
-- exactly what scripts/68 already showed them as: 0 members, is_active
-- false, no real signal of use. Whether to delete those empty cell rows
-- too (same as scripts/69 did for the demo departments) is a follow-up
-- decision, not made here — this script only removes the fabricated
-- numbers, not the cells themselves.
