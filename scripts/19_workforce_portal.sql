-- SHEP.HERD — Workforce self-serve portal.
-- Rank-and-file workforce members (ushers, choir, media, etc.) currently
-- only exist as rows in workforce_roster_entries/workforce_profiles — they
-- have no login of their own, so they rely on a department head to tell
-- them what they're serving. This adds the one column needed to give them
-- an account: a link from users -> members, so a 'workforce' role login
-- knows which member (and therefore which roster entries) is theirs.

ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id);
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);

-- Same link on invites, so an invite created for a specific roster member
-- carries it through to the users row register/complete creates.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id);
