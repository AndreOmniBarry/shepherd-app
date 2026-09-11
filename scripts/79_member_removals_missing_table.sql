-- ============================================================
-- member_removals -- table was never actually created in production
-- Run in Supabase SQL editor
--
-- 15_member_removals.sql fully defines this table (CREATE TABLE IF NOT
-- EXISTS member_removals ...) and was written specifically to back
-- /api/update/member-removals's "recommend a removal" pipeline for
-- fellowship_head/department_head. It was apparently never actually run
-- against the live database -- confirmed live: POSTing a real removal
-- recommendation through the real endpoint returns PostgREST 404 with
-- an empty body for the table itself.
--
-- The route's POST handler never checked res.ok on that insert (same
-- gap already fixed in member-additions/route.ts, see PR fixing
-- member_additions): it read the empty {} body, saw it wasn't an
-- array, and returned it as-is with error: null at HTTP 201 -- so the
-- Update portal showed "Submitted for approval." for a recommendation
-- that was never written anywhere. GET and PATCH happen to fail safe
-- (an empty {} isn't an array, so GET's Array.isArray(data) ? data :
-- [] silently returns an empty list, and PATCH's "record not found"
-- check already 404s correctly) -- only POST's false-success needed an
-- app-code fix, shipped alongside this migration.
--
-- This is a straight copy of 15_member_removals.sql's table definition
-- (IF NOT EXISTS throughout, so safe to run regardless of whatever
-- partial state actually exists in production).
-- ============================================================

CREATE TABLE IF NOT EXISTS member_removals (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id             UUID REFERENCES members(id) ON DELETE SET NULL,
  member_name           TEXT NOT NULL,
  reason                TEXT NOT NULL,
  recommended_by        UUID NOT NULL,
  recommended_by_name   TEXT,
  recommended_by_role   TEXT,
  fellowship_id         UUID,
  department_id         UUID,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by           UUID,
  approved_at           TIMESTAMPTZ,
  approval_comment      TEXT,
  pastor_revoked        BOOLEAN NOT NULL DEFAULT false,
  pastor_revoke_reason  TEXT,
  pastor_revoked_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- RLS on, no permissive policy — every API route uses the service-role key
-- (which bypasses RLS entirely), so anon/authenticated correctly get zero
-- direct access rather than the "USING (true)" pattern used in older
-- scripts. Matches 15_member_removals.sql exactly -- no CREATE POLICY here
-- is deliberate, not an oversight.
ALTER TABLE member_removals ENABLE ROW LEVEL SECURITY;
