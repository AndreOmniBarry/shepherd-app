-- service_plans (Order of Service) was missed in the original branch
-- scoping pass (script 25) — needed now that the planner is branch-aware.
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

DO $$
DECLARE gd_id UUID;
BEGIN
  SELECT id INTO gd_id FROM branches WHERE name = 'Grace Dome';
  UPDATE service_plans SET branch_id = gd_id WHERE branch_id IS NULL;
END $$;
