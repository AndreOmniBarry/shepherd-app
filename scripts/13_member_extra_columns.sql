-- ============================================================
-- Extra member fields needed for Create Member + approval chain
-- Run once in the Supabase SQL editor.
-- ============================================================
ALTER TABLE members ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS department_interest TEXT;

-- member_additions already has l1_status/l2_status/pastor_revoked columns
-- (scripts/10_member_creation_chain.sql) but no created_member_id to link
-- back to the live member row once approved, and no department_id for
-- department-sourced submissions.
ALTER TABLE member_additions ADD COLUMN IF NOT EXISTS created_member_id UUID REFERENCES members(id);
ALTER TABLE member_additions ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE member_additions ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE member_additions ADD COLUMN IF NOT EXISTS gender TEXT;
