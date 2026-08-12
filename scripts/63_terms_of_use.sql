-- ============================================================
-- Terms of Use acceptance tracking
--
-- There was no terms_accepted_at column and no acceptance UI anywhere in
-- the app before this — the "ToU popup" the founder expected to see was
-- never actually built, not a runtime bug. This adds the column the new
-- TermsGate component + /api/auth/accept-terms route need.
--
-- Purely additive: nullable column, no backfill, no data loss risk.
-- Existing accounts simply see the popup once on their next page load
-- until they accept.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;
