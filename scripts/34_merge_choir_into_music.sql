-- ============================================================
-- Merge "Choir" into "Music", then rename "Music" -> "Music Department".
-- Run PART 1 first to see how many real members/heads/rosters each
-- department actually has before anything moves.
-- ============================================================

-- PART 1: diagnostic — confirm both departments and their real usage
SELECT d.id, d.name,
       (SELECT count(*) FROM department_members dm WHERE dm.department_id = d.id) AS member_count,
       (SELECT count(*) FROM users u WHERE u.department_id = d.id) AS head_accounts,
       (SELECT count(*) FROM workforce_profiles wp WHERE wp.primary_department_id = d.id) AS workforce_profiles
FROM departments d
WHERE d.name IN ('Music', 'Choir', 'Music Department');

-- PART 2: merge Choir's members/heads/workforce profiles into Music,
-- then rename Music -> "Music Department", then remove the now-empty
-- Choir row. Safe to run even if Choir has zero members — the UPDATEs
-- just affect zero rows in that case.
DO $$
DECLARE music_id UUID; choir_id UUID;
BEGIN
  SELECT id INTO music_id FROM departments WHERE name = 'Music' LIMIT 1;
  SELECT id INTO choir_id FROM departments WHERE name = 'Choir' LIMIT 1;

  IF music_id IS NULL THEN
    RAISE EXCEPTION 'No department named exactly "Music" found — nothing to rename. Check PART 1 output.';
  END IF;

  IF choir_id IS NOT NULL THEN
    UPDATE department_members SET department_id = music_id WHERE department_id = choir_id
      AND NOT EXISTS (SELECT 1 FROM department_members dm2 WHERE dm2.department_id = music_id AND dm2.member_id = department_members.member_id);
    DELETE FROM department_members WHERE department_id = choir_id;
    UPDATE users SET department_id = music_id WHERE department_id = choir_id;
    UPDATE workforce_profiles SET primary_department_id = music_id WHERE primary_department_id = choir_id;
    UPDATE workforce_rosters SET department_id = music_id WHERE department_id = choir_id;
    DELETE FROM departments WHERE id = choir_id;
  END IF;

  UPDATE departments SET name = 'Music Department' WHERE id = music_id;
END $$;

-- PART 3: verify
SELECT id, name FROM departments WHERE name ILIKE '%music%' OR name ILIKE '%choir%';
