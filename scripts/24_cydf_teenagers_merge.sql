-- Merge Teenager's Fellowship into CYDF, per your instruction: they're one
-- group at this church. CYDF is the surviving fellowship (it's already
-- flagged is_aggregate_only) and gets renamed to reflect the real combined
-- group. Teenager's Fellowship's 42 real members move over so nothing is
-- orphaned; its head account moves too rather than being deleted, so both
-- leaders keep access to the combined fellowship — deactivate either
-- account afterward yourselves if you only want one leader going forward.

-- Move the 42 real members
UPDATE members SET fellowship_id = 'cb72d6c2-a206-45b9-895c-a26d705d2367'
WHERE fellowship_id = 'd5075b91-09de-4c8a-b976-90a6d7e6ee76';

-- Move Teenager's Fellowship's head account so they still have access
UPDATE users SET fellowship_id = 'cb72d6c2-a206-45b9-895c-a26d705d2367'
WHERE fellowship_id = 'd5075b91-09de-4c8a-b976-90a6d7e6ee76' AND role = 'fellowship_head';

-- Rename the surviving fellowship
UPDATE fellowships SET name = 'Children and Teenagers Fellowship'
WHERE id = 'cb72d6c2-a206-45b9-895c-a26d705d2367';

-- Verify — should show 0 remaining members/heads on the old row before you
-- delete it. If this shows anything other than 0, stop and paste it back.
SELECT
  (SELECT count(*) FROM members WHERE fellowship_id = 'd5075b91-09de-4c8a-b976-90a6d7e6ee76') AS remaining_members,
  (SELECT count(*) FROM users WHERE fellowship_id = 'd5075b91-09de-4c8a-b976-90a6d7e6ee76') AS remaining_users;

-- Only run this once the verify above shows 0 and 0:
-- DELETE FROM fellowships WHERE id = 'd5075b91-09de-4c8a-b976-90a6d7e6ee76';
