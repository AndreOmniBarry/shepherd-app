-- SHEP.HERD — #33: review the 31 cell shells before deciding whether to
-- delete them. PURE SELECT — nothing here deletes or changes anything.
--
-- These are the June-3-batch cells whose fake attendance history
-- scripts/71_purge_fake_attendance_history.sql already cleared. What's
-- left to decide is the cells themselves — the shells underneath that
-- fake history. Deliberately excluded from this list (not candidates,
-- already settled):
--   - Men's Fellowship  — real, holds your 29 actual members
--   - Power House Cell  — has one real-looking submission (2026-07-17)
--     after the fake batch ended
--   - Glory House Cell  — never matched the fake pattern at all
--
-- member_count / active_leader_accounts / meeting_logs are checked fresh
-- here (not just carried over from script 68's earlier run) in case
-- anything's changed since. attendance_records_now should read 0 for
-- every row if 71 already ran clean.
SELECT
  c.name,
  c.id,
  c.is_active,
  c.created_at,
  (SELECT count(*) FROM members m WHERE m.cell_id = c.id) AS member_count,
  (SELECT count(*) FROM users u WHERE u.cell_id = c.id AND u.role = 'cell_leader' AND u.is_active) AS active_leader_accounts,
  (SELECT count(*) FROM cell_meetings cm WHERE cm.cell_id = c.id) AS meeting_logs,
  (SELECT count(*) FROM attendance_records ar WHERE ar.cell_id = c.id) AS attendance_records_now
FROM cells c
WHERE c.id IN (
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
)
ORDER BY c.name;
