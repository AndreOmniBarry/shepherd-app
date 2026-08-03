-- ============================================================
-- financial_periods was missed entirely by 42_multi_tenant_churches.sql —
-- it has no church_id column, AND period_month carries a GLOBAL unique
-- constraint. In a multi-tenant world that isn't just a data-leak gap
-- (every church would see every other church's closed-period notes), it's
-- a functional blocker: once any one church closes, say, March 2026, no
-- other church on the platform could ever close their own March 2026.
--
-- Fix: add church_id, backfill existing rows to the fixed production
-- church id (same pattern as 42), drop the global unique constraint on
-- period_month alone, and replace it with a composite unique constraint
-- on (church_id, period_month) so each church closes its own months
-- independently.
-- ============================================================

ALTER TABLE financial_periods ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES churches(id);
UPDATE financial_periods SET church_id = '00000000-0000-0000-0000-000000000001' WHERE church_id IS NULL;

ALTER TABLE financial_periods DROP CONSTRAINT IF EXISTS financial_periods_period_month_key;
ALTER TABLE financial_periods ADD CONSTRAINT financial_periods_church_period_unique UNIQUE (church_id, period_month);

CREATE INDEX IF NOT EXISTS idx_financial_periods_church ON financial_periods(church_id);

-- Verify: should return 0.
SELECT 'financial_periods' AS table_name, count(*) AS missing_church_id FROM financial_periods WHERE church_id IS NULL;
