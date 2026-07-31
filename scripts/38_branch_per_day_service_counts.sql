-- ============================================================
-- Per-DAY service counts, not one flat number for the whole branch.
-- Real Nigerian churches commonly run several Sunday services (e.g. 3)
-- but only one midweek service — the previous services_per_day column
-- couldn't express that difference. day_service_counts is a JSON map like
-- {"Sunday": 3, "Wednesday": 1}; any configured day missing from the map
-- falls back to 1. Backfilled from the existing flat services_per_day so
-- nothing changes in behavior until someone edits a branch's schedule.
-- ============================================================

ALTER TABLE branches ADD COLUMN IF NOT EXISTS day_service_counts JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE b RECORD; d TEXT; counts JSONB;
BEGIN
  FOR b IN SELECT id, service_days, services_per_day FROM branches WHERE day_service_counts = '{}'::jsonb
  LOOP
    counts := '{}'::jsonb;
    FOREACH d IN ARRAY b.service_days LOOP
      counts := counts || jsonb_build_object(d, COALESCE(b.services_per_day, 1));
    END LOOP;
    UPDATE branches SET day_service_counts = counts WHERE id = b.id;
  END LOOP;
END $$;
