-- ============================================================
-- Meeting Requests — lets any staff/leader account request a meeting
-- with another account in the same branch (e.g. a department head
-- requesting time with the branch pastor, or a cell leader requesting
-- time with their fellowship head). Feeds the new Church Center tab.
-- ============================================================

CREATE TABLE IF NOT EXISTS meeting_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID REFERENCES branches(id),
  requested_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_of  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  message       TEXT,
  proposed_time TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meeting_requests_requested_of ON meeting_requests(requested_of);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_requested_by ON meeting_requests(requested_by);
