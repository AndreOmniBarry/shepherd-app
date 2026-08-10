-- ══════════════════════════════════════════════════════════════════
-- #29b — carry branch_id through the invite flow.
--
-- Confirmed by grepping every tracked migration script: 25_branches.sql
-- added branch_id to members, cells, fellowships, departments, users,
-- church_events, services, income_records, expense_requisitions — but
-- NOT to invites. No later script adds it either (42_multi_tenant_churches.sql
-- only added church_id to invites). This environment cannot reach the
-- live database to confirm directly (Supabase egress is blocked here),
-- so the column's absence is being treated as the safe assumption, not
-- a confirmed fact — this script is additive/idempotent either way, so
-- it's safe to run even if the column somehow already exists.
--
-- Additive only. Safe to re-run.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE invites ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- No backfill block: unlike 25_branches.sql (which backfilled every
-- pre-existing row to Grace Dome because that data already existed and
-- unambiguously belonged there), existing invite rows have no reliable
-- signal for which branch they were meant for — leaving them NULL is
-- correct, not a gap. New invites created after this script runs will
-- carry branch_id going forward via the app.
