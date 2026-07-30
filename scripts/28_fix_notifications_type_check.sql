-- The notifications.type CHECK constraint was defined before several
-- newer notification types existed (commendation being the one that just
-- broke in production — "notifications_type_check" violation on send).
-- Rebuilding it as a superset of every type value the app actually inserts
-- today, so no existing notification row can violate it and no send path
-- can hit this again next time a new type is added without remembering
-- this constraint exists.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'pipeline',
    'attendance',
    'giving',
    'pastoral',
    'absence',
    'pastor_instruction',
    'commendation',
    'service',
    'system'
  )
);
