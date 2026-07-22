-- ============================================================
-- SHEP.HERD — Department Attendance Tables
-- Run in Supabase SQL editor
-- Mirrors attendance_records / attendance_entries but scoped to
-- departments instead of cells. Referenced by:
--   src/app/api/department/attendance/route.ts (POST/GET)
--   src/app/api/department/overview/route.ts (GET)
--   src/app/api/analytics/attendance/route.ts (GET)
-- ============================================================

CREATE TABLE IF NOT EXISTS department_attendance (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id    UUID REFERENCES services(id),
  department_id UUID REFERENCES departments(id),
  submitted_by  UUID REFERENCES users(id),
  present_count INT NOT NULL DEFAULT 0,
  absent_count  INT NOT NULL DEFAULT 0,
  visitor_count INT NOT NULL DEFAULT 0,
  is_locked     BOOLEAN NOT NULL DEFAULT false,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_grade     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, department_id)
);

CREATE TABLE IF NOT EXISTS department_attendance_entries (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id      UUID REFERENCES department_attendance(id) ON DELETE CASCADE,
  member_id      UUID REFERENCES members(id),
  status         TEXT NOT NULL CHECK (status IN ('present','absent')),
  absence_reason TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_attendance_dept ON department_attendance(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_attendance_service ON department_attendance(service_id);
CREATE INDEX IF NOT EXISTS idx_dept_attendance_entries_record ON department_attendance_entries(record_id);
CREATE INDEX IF NOT EXISTS idx_dept_attendance_entries_member ON department_attendance_entries(member_id);

ALTER TABLE department_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_attendance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "department_attendance_all" ON department_attendance FOR ALL USING (true);
CREATE POLICY "department_attendance_entries_all" ON department_attendance_entries FOR ALL USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE department_attendance;

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('department_attendance','department_attendance_entries')
ORDER BY table_name;
