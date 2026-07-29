-- ══════════════════════════════════════════════════════════════════
-- PART 1 — schema change (safe to run immediately)
-- Generalizes the old hardcoded "CYDF fellowship ID" into a per-fellowship
-- flag any church can set on any fellowship: "this fellowship doesn't track
-- individual members/cells, it's an aggregate headcount register." No
-- hardcoded IDs left in the app code after this.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE fellowships ADD COLUMN IF NOT EXISTS is_aggregate_only BOOLEAN DEFAULT false;

-- Mark Comforters House's existing CYDF fellowship as the aggregate-only one
-- (this is the same fellowship the app used to hardcode by UUID).
UPDATE fellowships SET is_aggregate_only = true WHERE id = 'cb72d6c2-a206-45b9-895c-a26d705d2367';

-- ══════════════════════════════════════════════════════════════════
-- PART 2 — READ-ONLY DIAGNOSTIC, run this and paste back the output.
-- Looking for a separate "Teenager's Fellowship" that should be folded into
-- CYDF (per your instruction to merge them into one "Children and
-- Teenagers Fellowship" for this church). Nothing below deletes anything.
-- ══════════════════════════════════════════════════════════════════

SELECT f.id, f.name, f.is_aggregate_only,
       (SELECT count(*) FROM members m WHERE m.fellowship_id = f.id) AS member_count,
       (SELECT count(*) FROM cells c WHERE c.fellowship_id = f.id) AS cell_count,
       (SELECT count(*) FROM users u WHERE u.fellowship_id = f.id AND u.role = 'fellowship_head') AS head_accounts
FROM fellowships f
WHERE f.name ILIKE '%teen%' OR f.name ILIKE '%cydf%' OR f.name ILIKE '%child%'
ORDER BY f.name;
