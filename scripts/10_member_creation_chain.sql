-- ============================================================
-- SHEP.HERD — Member Creation Approval Chain
-- Run in Supabase SQL editor
-- ============================================================

-- Member addition requests table (already exists as member_additions)
-- Enhance it with approval chain fields
ALTER TABLE member_additions
  ADD COLUMN IF NOT EXISTS l1_approver_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS l1_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS l1_status TEXT DEFAULT 'pending' CHECK (l1_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS l1_comment TEXT,
  ADD COLUMN IF NOT EXISTS l2_approver_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS l2_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS l2_status TEXT DEFAULT 'pending' CHECK (l2_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS l2_comment TEXT,
  ADD COLUMN IF NOT EXISTS pastor_revoked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pastor_revoke_reason TEXT,
  ADD COLUMN IF NOT EXISTS pastor_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by_role TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS department_interest TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'cell' CHECK (source IN ('cell','department','fellowship','direct'));

-- Absence + follow-up table
CREATE TABLE IF NOT EXISTS absence_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id),
  member_name TEXT NOT NULL,
  cell_id UUID,
  fellowship_id UUID,
  service_date DATE NOT NULL,
  submitted_by UUID REFERENCES users(id),
  submitted_by_name TEXT,
  reason TEXT NOT NULL,
  reason_detail TEXT,
  requires_followup BOOLEAN DEFAULT false,
  followup_scope TEXT,
  outreach_efforts TEXT,
  followup_status TEXT DEFAULT 'pending' CHECK (followup_status IN ('pending','in_progress','resolved','no_action')),
  pastor_instruction TEXT,
  pastor_instruction_visibility TEXT[] DEFAULT ARRAY['all'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime
ALTER TABLE absence_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "absence_reports_all" ON absence_reports FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE absence_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE member_additions;

-- Request audit log
CREATE TABLE IF NOT EXISTS request_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_type TEXT NOT NULL,
  request_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_name TEXT,
  actor_role TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE request_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_all" ON request_audit_log FOR ALL USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE request_audit_log;

-- Verify
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('absence_reports','request_audit_log','member_additions')
ORDER BY table_name;
