-- SHEP.HERD — Care team upgrade: full first-timer card, prayer routing, SLA.

ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS would_join TEXT; -- 'yes' | 'maybe' | 'no'
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS volunteer_interest TEXT;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS prayer_point TEXT;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS cell_id UUID REFERENCES cells(id) ON DELETE SET NULL;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS completed_member_class BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS sla_grade TEXT;

ALTER TABLE care_leads ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE care_leads ADD COLUMN IF NOT EXISTS sla_grade TEXT;
