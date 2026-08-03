-- ============================================================
-- The Partnership module (partners, partnership_bands,
-- partnership_giving) was missed entirely by 42_multi_tenant_churches.sql
-- — none of its tables ever got a church_id column, so every church on
-- the platform shared one global partner directory and giving ledger.
-- Same backfill pattern as 42: existing rows are pinned to the fixed
-- production church id.
-- ============================================================

ALTER TABLE partnership_bands ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE partnership_bands SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE partners ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE partners SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE partnership_giving ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE partnership_giving SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_partners_church ON partners(church_id);
CREATE INDEX IF NOT EXISTS idx_partnership_giving_church ON partnership_giving(church_id);
CREATE INDEX IF NOT EXISTS idx_partnership_bands_church ON partnership_bands(church_id);

-- Verify: should return 0 for all three.
SELECT 'partners' AS table_name, count(*) AS missing_church_id FROM partners WHERE church_id IS NULL
UNION ALL SELECT 'partnership_giving', count(*) FROM partnership_giving WHERE church_id IS NULL
UNION ALL SELECT 'partnership_bands', count(*) FROM partnership_bands WHERE church_id IS NULL;
