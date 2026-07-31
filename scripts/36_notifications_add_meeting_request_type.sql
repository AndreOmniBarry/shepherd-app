-- Adds 'meeting_request' to the notifications.type CHECK constraint so
-- Church Center's meeting-request feature can notify people without
-- hitting the same notifications_type_check violation commendations did.
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
    'system',
    'meeting_request'
  )
);
