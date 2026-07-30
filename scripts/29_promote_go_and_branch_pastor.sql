-- Uzor Echiejile and Valentine Ose already have working overseer/pa accounts —
-- they were just never actually assigned the general_overseer/branch_pastor
-- roles, which is why nothing showed up to preview under those roles. This
-- promotes them in place (same login, same password, same id) rather than
-- creating new accounts.
UPDATE users
SET role = 'general_overseer', branch_id = NULL
WHERE id = 'ab107e8d-4329-47bf-8a86-1cfd6f4d469b'; -- Uzor Echiejile

UPDATE users
SET role = 'branch_pastor',
    branch_id = (SELECT id FROM branches WHERE name = 'Victory Tabernacle')
WHERE id = 'a78de93b-269e-4564-bb58-590e3a277a87'; -- Valentine Ose

-- Confirm
SELECT id, full_name, role, branch_id FROM users
WHERE id IN ('ab107e8d-4329-47bf-8a86-1cfd6f4d469b', 'a78de93b-269e-4564-bb58-590e3a277a87');
