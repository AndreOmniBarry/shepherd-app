-- ============================================================
-- SHEP.HERD — Platform cost accounting (Claude tokens, Paystack fees,
-- storage volume, and generic admin-entered platform bills)
-- Run in Supabase SQL editor. Additive and idempotent — safe to re-run.
--
-- Backs the "Usage & Spend" command center's cost-vs-revenue margin view:
--   1. usage_events.type gains 'storage' — src/app/api/media/upload/route.ts
--      logs one row per upload with cost_ngn=0 (no defensible per-byte NGN
--      estimate yet) and the real byte count in metadata, so the command
--      center gets exact storage-volume-per-church numbers today even
--      without a cost figure attached.
--   2. billing_transactions gains fee_ngn — the EXACT amount Paystack
--      charged for processing a transaction (their own `data.fees` field,
--      same kobo unit as `data.amount`), captured on charge.success by
--      src/app/api/webhooks/paystack/route.ts. This is exact, metered
--      data from Paystack itself — not an estimate — same tier of
--      precision as the real Claude token cost.
--   3. platform_cost_line_items — a small admin-entered list of recurring
--      platform bills (Supabase, Vercel, anything added later) that have
--      no per-request metering of their own. Each line item's
--      monthly_bill_ngn is entered by hand (nullable — null means "not
--      yet entered"); the command center allocates it across churches by
--      their relative share of DB-row + storage-byte footprint (computed
--      live — see src/lib/platform-footprint.ts). This is ALWAYS an
--      allocated estimate of the real bill, never an exact metered cost,
--      and is labeled that way everywhere it's surfaced — never blurred
--      together with the exact Claude/Paystack figures into one falsely-
--      precise total.
-- ============================================================

-- (1) storage usage type
ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_type_check;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_type_check
  CHECK (type IN ('moshe', 'sms', 'whatsapp', 'storage'));

-- (2) exact Paystack processing fee per transaction
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS fee_ngn NUMERIC(10,2);

-- (3) generic admin-entered platform cost line items
CREATE TABLE IF NOT EXISTS platform_cost_line_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,              -- e.g. "Supabase", "Vercel"
  monthly_bill_ngn  NUMERIC(12,2),                      -- NULL = not yet entered by admin
  -- Which footprint measure to allocate this bill by. Only one measure
  -- exists today (the shared DB-row + storage-byte footprint every line
  -- item reuses by default) — this column exists so a bandwidth-specific
  -- or otherwise different measure can be introduced later per line item
  -- without a schema change, not because one is needed now.
  footprint_measure TEXT NOT NULL DEFAULT 'db_and_storage',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the Supabase line item so it shows up immediately (still NULL —
-- "not set" — until the founder enters the real monthly bill).
INSERT INTO platform_cost_line_items (name)
SELECT 'Supabase' WHERE NOT EXISTS (SELECT 1 FROM platform_cost_line_items WHERE name = 'Supabase');
