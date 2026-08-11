-- ============================================================
-- Media attachments for Church Feed posts and Chat messages — a single
-- image attachment each, kept simple (no gallery/multi-image, no video).
--
-- Recon before writing this: there is no existing image-upload pattern
-- anywhere in this codebase to reuse (checked event cover images, church
-- logo, profile pictures — `logo_url` etc. are plain text URL fields with
-- no upload flow behind them; grepped the whole repo for `.storage.` /
-- `supabase.storage` / an `/api/*upload*` route and found nothing). So
-- this introduces the app's first real upload flow:
--   src/app/api/media/upload/route.ts — accepts multipart/form-data,
--   validates type (jpeg/png/webp/gif) and size (<=5MB), uploads to
--   Supabase Storage via the service-role key (same "service role bypasses
--   RLS" pattern every other route in this app already uses for Postgres
--   REST calls), and returns a public URL to attach to the post/message.
--
-- ------------------------------------------------------------------
-- MANUAL STEP REQUIRED — Supabase Dashboard (cannot be done from SQL/this
-- migration; creating/configuring a Storage bucket is a dashboard-only
-- action in this project's workflow):
--   1. Supabase Dashboard → Storage → "New bucket".
--   2. Name it exactly:            church-media
--   3. Public bucket:              ON
--      (media is served as plain public URLs, same as every other public
--      asset URL already in this app — e.g. event cover / logo URLs)
--   4. File size limit:            5 MB
--   5. Allowed MIME types:         image/jpeg, image/png, image/webp, image/gif
--   No additional Storage policies are required: every upload goes
--   through src/app/api/media/upload/route.ts using the service-role key
--   server-side, which bypasses Storage RLS the same way every existing
--   route in this app bypasses table RLS via the service-role key. Public
--   reads work because the bucket itself is public.
-- ------------------------------------------------------------------

ALTER TABLE feed_posts    ADD COLUMN IF NOT EXISTS media_url  TEXT;
ALTER TABLE feed_posts    ADD COLUMN IF NOT EXISTS media_type TEXT;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_url  TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
