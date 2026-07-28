-- SHEP.HERD — Events v2: multi-day programs, richer registrant profile.
-- Existing single-day events keep working unchanged (end_date defaults to
-- null, meaning "same day as event_date" everywhere this is read).

ALTER TABLE church_events ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS attending_days DATE[];
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS guest_type TEXT DEFAULT 'member'
  CHECK (guest_type IN ('member','minister','guest'));
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS companion_count INTEGER DEFAULT 0;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS expectations TEXT;
