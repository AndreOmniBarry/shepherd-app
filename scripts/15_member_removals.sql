-- SHEP.HERD — Member removal recommendation chain.
--
-- Mirrors member_additions (scripts/10_member_creation_chain.sql) but for the
-- opposite direction: taking a member OFF the active roster. Per the church's
-- explicit permission model:
--   - Cell leaders cannot start this at all — they raise it with their
--     fellowship head offline first.
--   - Fellowship heads and department heads can RECOMMEND a removal (logged,
--     with a reason) — this does not touch the member record yet.
--   - The PA (or overseer/lead_tech) AUTHORISES the recommendation, which is
--     what actually marks the member inactive. This is what keeps the pastor
--     from being bottlenecked by routine approvals.
--   - Only the overseer (pastor) can REVOKE an already-approved removal, with
--     a required comment — full oversight without being in the approval loop.
--   - Permanently DELETING a member is a separate, unrelated action reserved
--     solely for the overseer (see DELETE /api/update/members/[id]) — this
--     table is only ever a reversible "make inactive" workflow.

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
-- direct access rather than the "USING (true)" pattern used in older scripts.
ALTER TABLE member_removals ENABLE ROW LEVEL SECURITY;
