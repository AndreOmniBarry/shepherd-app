-- Second pass on branch scoping — first_timers and care_leads don't
-- reliably tie back to a branch through an existing column (first-timers
-- especially aren't necessarily linked to a members row), so they get
-- their own branch_id, same pattern as scripts/25.
ALTER TABLE first_timers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE care_leads ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

DO $$
DECLARE gd_id UUID;
BEGIN
  SELECT id INTO gd_id FROM branches WHERE name = 'Grace Dome';
  UPDATE first_timers SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE care_leads SET branch_id = gd_id WHERE branch_id IS NULL;
END $$;
