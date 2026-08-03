-- ============================================================
-- expense_categories and income_types were global catalog tables shared
-- by every church — lower severity than the records/PII gaps elsewhere
-- (it's category labels, not financial records), but inconsistent with
-- the rest of the accounts module now being fully church-scoped, and a
-- new church's category dropdown would otherwise be polluted with (or
-- limited to) another church's custom category names.
-- Same backfill pattern as the other multi-tenant migrations.
-- ============================================================

ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE expense_categories SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE income_types ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE income_types SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_categories_church ON expense_categories(church_id);
CREATE INDEX IF NOT EXISTS idx_income_types_church ON income_types(church_id);

-- Verify: should return 0 for both.
SELECT 'expense_categories' AS table_name, count(*) AS missing_church_id FROM expense_categories WHERE church_id IS NULL
UNION ALL SELECT 'income_types', count(*) FROM income_types WHERE church_id IS NULL;
