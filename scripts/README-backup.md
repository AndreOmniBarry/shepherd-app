# Nightly database backup — setup

This repo has a GitHub Actions workflow (`.github/workflows/db-backup.yml`) that
dumps the whole Supabase database every night and stores it as a downloadable
file attached to the workflow run. It costs nothing extra — it runs on GitHub's
free Actions minutes, and the file is tiny for a database this size.

## One-time setup (you need to do this once)

1. Get your database connection string:
   Supabase Dashboard → your project → **Project Settings → Database** →
   under "Connection string" pick **URI** (use the "Session pooler" or
   "Transaction pooler" variant if given a choice — either works for `pg_dump`).
   It looks like:
   `postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres`
   Replace `[YOUR-PASSWORD]` with your actual database password (this is the
   Postgres password, not any of the API keys — reset it on the same page if
   you don't have it saved).

2. Add it as a GitHub secret (not committed to the repo, never visible in
   logs): GitHub → your repo → **Settings → Secrets and variables → Actions →
   New repository secret** → name it `SUPABASE_DB_URL`, paste the full
   connection string as the value.

3. That's it. The workflow runs automatically every night at 03:00 UTC, and
   you can also trigger it manually any time from the **Actions** tab →
   "Nightly database backup" → **Run workflow**.

## Restoring from a backup

1. GitHub → **Actions** tab → find the backup run you want → download the
   `shepherd-db-backup-...` artifact (a `.dump` file).
2. Restore it into a Postgres database with:
   `pg_restore --clean --if-exists -d "$SUPABASE_DB_URL" shepherd_backup.dump`
   Only do this against a database you intend to overwrite — `--clean` drops
   existing objects before recreating them.

## Limits of the free tier

- Artifacts are kept for 30 days (set in the workflow's `retention-days`),
  then GitHub deletes them automatically — download anything you want to
  keep longer term.
- This is a full logical dump, not point-in-time recovery — you can restore
  to any night's snapshot, not to an arbitrary minute in between. Supabase's
  paid Pro plan adds real point-in-time recovery if that precision matters
  later.
