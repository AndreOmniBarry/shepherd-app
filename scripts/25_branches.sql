-- ══════════════════════════════════════════════════════════════════
-- Multi-branch foundation. Safe, additive, backfill-only — nothing here
-- deletes or reassigns anything without an explicit, separate step below.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS branches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT UNIQUE NOT NULL,
  is_headquarters BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO branches (name, is_headquarters) VALUES ('Grace Dome', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO branches (name, is_headquarters) VALUES ('Victory Tabernacle', false)
  ON CONFLICT (name) DO NOTHING;

-- branch_id on every core structural/data table. NULL for now until backfilled below.
ALTER TABLE members ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE cells ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE fellowships ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE church_events ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE services ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
ALTER TABLE expense_requisitions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Backfill: everything that exists today IS Grace Dome's data — this is
-- purely attaching a label to what's already there, not moving anything.
DO $$
DECLARE gd_id UUID;
BEGIN
  SELECT id INTO gd_id FROM branches WHERE name = 'Grace Dome';
  UPDATE members SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE cells SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE fellowships SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE departments SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE users SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE church_events SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE services SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE income_records SET branch_id = gd_id WHERE branch_id IS NULL;
  UPDATE expense_requisitions SET branch_id = gd_id WHERE branch_id IS NULL;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- NOT run automatically — review and run yourself when ready.
-- Promotes your current overseer account(s) to the new top-level role that
-- sees every branch + the consolidated view. Grace Dome still needs its own
-- branch_pastor afterward (either the same person, or a new invite) — this
-- statement only changes the role label on the account(s) you already have.
-- ══════════════════════════════════════════════════════════════════

-- SELECT id, full_name, email, role FROM users WHERE role = 'overseer';
-- UPDATE users SET role = 'general_overseer' WHERE role = 'overseer' AND id = '<the id from the select above>';
