-- Audit trail: who did what, when, to which record. Append-only — nothing
-- in the app ever updates or deletes a row here.
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id),
  actor_role  TEXT,
  action      TEXT NOT NULL,        -- e.g. 'cell_merge', 'member_removal_approved', 'invite_created'
  target_type TEXT,                 -- e.g. 'cell', 'member', 'invite'
  target_id   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
