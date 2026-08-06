-- ============================================================
-- SHEP.HERD — Event registration logistics fields
-- Run in Supabase SQL editor
--
-- Mentor review feedback: the public event registration form never
-- captured a registrant's address, or whether they need transportation
-- or accommodation for the program — information Protocol/Care & Follow-up
-- need to actually plan around. Written by POST /api/events/register,
-- read by the registrant list + the new form-analytics summary on that
-- same route (GET), surfaced on the Pastor/PA/Tech/Care/Protocol portals.
-- ============================================================

ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS needs_transportation BOOLEAN DEFAULT false;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS needs_accommodation BOOLEAN DEFAULT false;
