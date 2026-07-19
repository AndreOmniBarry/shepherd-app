-- ============================================================
-- SHEP.HERD — Fix duplicate church_config rows
-- Run this in Supabase SQL editor if you have multiple rows
-- ============================================================

-- Check how many rows you have
SELECT id, church_name, created_at, updated_at FROM church_config ORDER BY updated_at DESC;

-- If you have more than 1 row, keep the most recently updated and delete the rest:
DELETE FROM church_config
WHERE id NOT IN (
  SELECT id FROM church_config ORDER BY updated_at DESC LIMIT 1
);

-- Verify
SELECT church_name, structure_type, tier1_label, tier2_label, is_configured FROM church_config;
