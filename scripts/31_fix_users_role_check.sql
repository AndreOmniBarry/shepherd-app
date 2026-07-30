-- users.role has a CHECK constraint that predates general_overseer and
-- branch_pastor (added for the multi-branch model) — confirmed by the
-- exact failure promoting Uzor Echiejile: "violates check constraint
-- users_role_check". Rebuilding it as a superset of every role value the
-- app actually uses (src/types/index.ts Role type), so no existing user
-- row can violate it and promoting someone to a newer role can't hit
-- this again.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'cell_leader',
    'fellowship_head',
    'department_head',
    'overseer',
    'general_overseer',
    'branch_pastor',
    'pa',
    'lead_tech',
    'accounts',
    'partnership',
    'care_team',
    'workforce'
  )
);

-- Re-run both promotions from script 29 — the whole script rolled back
-- when the first UPDATE hit the constraint, so Valentine's never ran either.
UPDATE users
SET role = 'general_overseer', branch_id = NULL
WHERE id = 'ab107e8d-4329-47bf-8a86-1cfd6f4d469b'; -- Uzor Echiejile

UPDATE users
SET role = 'branch_pastor',
    branch_id = (SELECT id FROM branches WHERE name = 'Victory Tabernacle')
WHERE id = 'a78de93b-269e-4564-bb58-590e3a277a87'; -- Valentine Ose

SELECT id, full_name, role, branch_id FROM users
WHERE id IN ('ab107e8d-4329-47bf-8a86-1cfd6f4d469b', 'a78de93b-269e-4564-bb58-590e3a277a87');
