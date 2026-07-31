-- ============================================================
-- Per-branch service schedule — branches can now have their own service
-- days (e.g. Victory Tabernacle meets Sunday + Wednesday while a third
-- branch meets Saturday + Tuesday) and their own number of services per
-- day (up to however many a branch actually runs, not capped at 2).
-- Safe/additive: every existing branch is backfilled from the church's
-- current single service_days config, so nothing changes in behavior
-- until someone actually edits a branch's schedule in Settings.
-- ============================================================

ALTER TABLE branches ADD COLUMN IF NOT EXISTS service_days TEXT[] NOT NULL DEFAULT ARRAY['Sunday'];
ALTER TABLE branches ADD COLUMN IF NOT EXISTS services_per_day SMALLINT NOT NULL DEFAULT 1;

DO $$
DECLARE cfg_days TEXT[];
BEGIN
  SELECT service_days INTO cfg_days FROM church_config LIMIT 1;
  IF cfg_days IS NOT NULL AND array_length(cfg_days, 1) > 0 THEN
    UPDATE branches SET service_days = cfg_days WHERE service_days = ARRAY['Sunday'];
  END IF;
END $$;

-- Grace Dome and Victory Tabernacle both currently run 2 services on their
-- primary day (matching the existing service_number 1|2 behavior) — set
-- explicitly so the cap-lift below doesn't change today's real schedule.
UPDATE branches SET services_per_day = 2 WHERE services_per_day = 1;
