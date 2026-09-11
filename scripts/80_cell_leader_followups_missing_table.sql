-- ============================================================
-- cell_leader_followups -- table referenced by app code, never defined anywhere
-- Run in Supabase SQL editor
--
-- /api/cell/followup (GET + POST) has always read from and written to
-- cell_leader_followups -- the log of what a cell leader actually did
-- ("Called member", "Left voicemail", etc.) when following up on an
-- absentee care_leads row. Unlike the other two missing-table bugs found
-- this session (member_removals, PR fixing "Recommend removal"), no
-- script anywhere in this repo ever defined this table at all -- it was
-- never created, not even attempted.
--
-- The POST handler never checked res.ok on the insert (same class of bug
-- fixed repeatedly this session): it read the empty {} error body,
-- returned it as "data" with error: null at HTTP 201, and -- worse than
-- the other instances -- went on to increment care_leads.contact_attempts
-- and bump last_contact regardless, and notified the lead's assigned
-- admin "Cell leader logged a follow-up: <action>". Net effect: a cell
-- leader's follow-up log is permanently lost, but the attempt counter
-- goes up and an admin is told an action was taken they can never
-- actually see the substance of.
--
-- Reproduced live: POSTing a real follow-up through the real endpoint
-- returned HTTP 201 with an empty data object; cell_leader_followups
-- doesn't exist so nothing was ever written, while contact_attempts and
-- last_contact on the underlying care_leads row were still updated.
-- ============================================================

CREATE TABLE IF NOT EXISTS cell_leader_followups (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id        UUID NOT NULL REFERENCES care_leads(id) ON DELETE CASCADE,
  cell_leader_id UUID NOT NULL REFERENCES users(id),
  action         TEXT NOT NULL,
  outcome        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cell_leader_followups_lead_id ON cell_leader_followups(lead_id);

-- RLS on, no permissive policy -- every API route uses the service-role key
-- (which bypasses RLS entirely), matching the convention already
-- established for member_removals (see 15_member_removals.sql).
ALTER TABLE cell_leader_followups ENABLE ROW LEVEL SECURITY;
