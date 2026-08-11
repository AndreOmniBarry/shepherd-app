-- ============================================================
-- branches.name carries a GLOBAL unique constraint from when this was a
-- single-tenant app (25_branches.sql: `name TEXT UNIQUE NOT NULL`).
-- church_id was retrofitted onto branches in 42_multi_tenant_churches.sql,
-- but the unique constraint was never migrated alongside it — same shape
-- of miss already found and fixed once on financial_periods.period_month
-- (46_financial_periods_church_id.sql).
--
-- Effect today: two churches both naming a branch "Main Campus" collide.
-- POST /api/branches uses `on_conflict=name` with `resolution=ignore-
-- duplicates`, so the second church's insert is silently dropped — the
-- API returns 201, but the branch never actually gets created.
--
-- Fix: drop the global unique constraint on name alone, replace it with a
-- composite unique constraint on (church_id, name) so each church names
-- its own branches independently.
-- ============================================================

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_name_key;
ALTER TABLE branches ADD CONSTRAINT branches_church_name_unique UNIQUE (church_id, name);

-- Verify: should return 0 duplicate (church_id, name) pairs pre-existing
-- from before this constraint existed (there shouldn't be any, since the
-- old global constraint already prevented same-name collisions even
-- across churches — this is just confirming the migration is safe to run).
SELECT church_id, name, count(*) FROM branches GROUP BY church_id, name HAVING count(*) > 1;
