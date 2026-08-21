-- SHEP.HERD — #33: delete the 30 confirmed-empty cell shells.
--
-- The 32 candidates scripts/72_review_empty_cell_shells.sql surfaced,
-- minus Eagles Cell and Trumpet Cell — both kept per the founder's
-- explicit call (Trumpet is a live test cell still in active use; Eagles
-- is grouped with it). Every one of these 30: 0 members, 0 active
-- cell_leader accounts, 0 meeting logs, and (after
-- scripts/71_purge_fake_attendance_history.sql) 0 attendance_records —
-- confirmed empty on every signal checked across scripts 68/70/71/72.
--
-- Learned the hard way on scripts/69/70: don't hand-pick a dependent-table
-- list from this repo's .sql files, since they don't reliably match live
-- schema. This pre-flight instead discovers every table in the public
-- schema that actually has a cell_id column right now, and checks all of
-- them dynamically — can't miss one, and can't error on a column that
-- doesn't exist.

-- ── PRE-FLIGHT — run first, alone. Every row's count should read 0.
DROP TABLE IF EXISTS _preflight_73;
CREATE TEMP TABLE _preflight_73 (check_name TEXT, row_count BIGINT);

DO $$
DECLARE
  target_ids UUID[] := ARRAY[
    '15b989ab-8a3a-43c9-83ed-2548c0e0bf40', -- Burning Bush Cell
    '15da46b5-3594-40ed-9b07-3733b2341e94', -- Living Waters Cell
    '161121b5-7316-4e84-8ad4-c9ec0fb94e08', -- Restoration Cell
    '1768d6ab-9a04-49e9-a2c9-c2d64632f886', -- Breakthrough Cell
    '1809e172-81d9-4353-affc-d0179dae8730', -- Emmanuel Cell
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
    'c8e3d0f1-e5a4-4a2e-965a-b20508ad4c98', -- Elevation Cell
    'f7611ce4-3fb3-48e4-8b5e-ef295253e4ff', -- Shalom Cell
    '062e1e85-f964-4a6e-be2e-3a6ec0c06d97', -- Champions Cell
    '00ad4abf-398a-4ced-8098-3f64503063dc', -- Rock of Ages Cell
    'f32111a1-d1ef-497d-aef4-ac7e25e4d427'  -- Kingdom Builders Cell
    -- Eagles Cell and Trumpet Cell deliberately excluded — kept, per the
    -- founder (Trumpet is a live test cell still in use).
  ];
  tbl RECORD;
  cnt BIGINT;
BEGIN
  INSERT INTO _preflight_73 VALUES ('cells_to_delete', array_length(target_ids, 1));

  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'cell_id'
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE cell_id = ANY($1)', tbl.table_name)
      INTO cnt USING target_ids;
    INSERT INTO _preflight_73 VALUES (tbl.table_name || '.cell_id', cnt);
  END LOOP;
END $$;

SELECT * FROM _preflight_73 ORDER BY check_name;

-- ── DELETE — only once every row above reads 0 ────────────────────────
BEGIN;

DELETE FROM cells WHERE id = ANY(ARRAY[
  '15b989ab-8a3a-43c9-83ed-2548c0e0bf40', '15da46b5-3594-40ed-9b07-3733b2341e94',
  '161121b5-7316-4e84-8ad4-c9ec0fb94e08', '1768d6ab-9a04-49e9-a2c9-c2d64632f886',
  '1809e172-81d9-4353-affc-d0179dae8730', '2da69a27-59c4-4ecb-8556-2ada5c7e7603',
  '33a90411-6c2f-4894-8e2d-a337704bae4f', '48b6edf1-0103-4201-8a63-d8ca0e390ef3',
  '58014731-1548-4e2c-948d-b544c00517f4', '5aab2a7e-824a-4b19-9cc3-756e04421df1',
  '675e8b93-8d38-4a5d-bb72-005a6b992cfb', '6f6207ed-f40e-4c1e-901c-a0b5cf7a194a',
  '7756b1b6-5c01-42f9-9482-3ea6d8924a5c', '78eff7d0-cc81-4ac7-9042-5abe5471f4da',
  '7f4075c8-1a2f-44ec-9f86-f306b0e121d1', '8010d467-ca62-4270-a107-29172834d7d1',
  '8338c2cc-db05-46fb-907d-5956bad09164', '83a17c21-3a46-4ff5-9a8c-31abe49ef24c',
  '9045abdf-cef3-47de-b87a-7625d82d5bc0', '91c99a31-e61b-4f85-81d5-2585a87f634a',
  '9b7ccd91-f004-4c2c-b18e-1c51346bc816', 'a0f31890-544e-4929-ae5b-4fa334d904b7',
  'a1176263-ae32-490a-b98e-49704996a979', 'a649c925-1274-4533-9a77-2ab1e53af364',
  'b021e73c-0a60-4836-9d53-f94b30d04c5e', 'c8e3d0f1-e5a4-4a2e-965a-b20508ad4c98',
  'f7611ce4-3fb3-48e4-8b5e-ef295253e4ff', '062e1e85-f964-4a6e-be2e-3a6ec0c06d97',
  '00ad4abf-398a-4ced-8098-3f64503063dc', 'f32111a1-d1ef-497d-aef4-ac7e25e4d427'
]::uuid[]);

COMMIT;

-- ── VERIFY — should return 0 rows ─────────────────────────────────────
SELECT id, name FROM cells WHERE id = ANY(ARRAY[
  '15b989ab-8a3a-43c9-83ed-2548c0e0bf40', '15da46b5-3594-40ed-9b07-3733b2341e94',
  '161121b5-7316-4e84-8ad4-c9ec0fb94e08', '1768d6ab-9a04-49e9-a2c9-c2d64632f886',
  '1809e172-81d9-4353-affc-d0179dae8730', '2da69a27-59c4-4ecb-8556-2ada5c7e7603',
  '33a90411-6c2f-4894-8e2d-a337704bae4f', '48b6edf1-0103-4201-8a63-d8ca0e390ef3',
  '58014731-1548-4e2c-948d-b544c00517f4', '5aab2a7e-824a-4b19-9cc3-756e04421df1',
  '675e8b93-8d38-4a5d-bb72-005a6b992cfb', '6f6207ed-f40e-4c1e-901c-a0b5cf7a194a',
  '7756b1b6-5c01-42f9-9482-3ea6d8924a5c', '78eff7d0-cc81-4ac7-9042-5abe5471f4da',
  '7f4075c8-1a2f-44ec-9f86-f306b0e121d1', '8010d467-ca62-4270-a107-29172834d7d1',
  '8338c2cc-db05-46fb-907d-5956bad09164', '83a17c21-3a46-4ff5-9a8c-31abe49ef24c',
  '9045abdf-cef3-47de-b87a-7625d82d5bc0', '91c99a31-e61b-4f85-81d5-2585a87f634a',
  '9b7ccd91-f004-4c2c-b18e-1c51346bc816', 'a0f31890-544e-4929-ae5b-4fa334d904b7',
  'a1176263-ae32-490a-b98e-49704996a979', 'a649c925-1274-4533-9a77-2ab1e53af364',
  'b021e73c-0a60-4836-9d53-f94b30d04c5e', 'c8e3d0f1-e5a4-4a2e-965a-b20508ad4c98',
  'f7611ce4-3fb3-48e4-8b5e-ef295253e4ff', '062e1e85-f964-4a6e-be2e-3a6ec0c06d97',
  '00ad4abf-398a-4ced-8098-3f64503063dc', 'f32111a1-d1ef-497d-aef4-ac7e25e4d427'
]::uuid[]);

-- Confirm Eagles Cell, Trumpet Cell, Power House Cell, Men's Fellowship,
-- and Glory House Cell are all still present and untouched.
SELECT id, name FROM cells WHERE name IN (
  'Eagles Cell', 'Trumpet Cell', 'Power House Cell', 'Men''s Fellowship', 'Glory House Cell'
);
