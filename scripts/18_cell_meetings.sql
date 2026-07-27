-- SHEP.HERD — Cell meeting tracker.
-- Cell leaders host a physical cell meeting at least once a week, separate
-- from Sunday/midweek church service attendance. This tracks that meeting
-- itself: who came, how long it ran, what was covered, and how promptly the
-- leader logged it — the same "logged promptly after the fact" pattern
-- already used for attendance/income/giving SLA grading.

CREATE TABLE IF NOT EXISTS cell_meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cell_id UUID REFERENCES cells(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_time TEXT,
  location TEXT,
  attendance_count INTEGER NOT NULL DEFAULT 0,
  visitor_count INTEGER NOT NULL DEFAULT 0,
  topic TEXT,
  minutes TEXT,
  submitted_by UUID REFERENCES users(id),
  sla_grade TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cell_meetings_cell_date ON cell_meetings(cell_id, meeting_date);

ALTER TABLE cell_meetings ENABLE ROW LEVEL SECURITY;
-- No permissive policy for anon/authenticated — every read/write goes
-- through the app's API routes using the service role key, same lockdown
-- pattern as every other table (see 14_security_lockdown.sql).
