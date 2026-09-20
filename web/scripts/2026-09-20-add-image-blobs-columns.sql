-- 2026-09-20 — Image durability: store a compressed fallback copy of every image
-- in Postgres so the public site never shows a broken image when a source URL 404s.
--
-- Adds blob_* columns to BOTH images and providers (provider headshots live on
-- providers.image_url, not the images table). Stored as raw bytea (not base64):
-- ~33% smaller and served as binary directly. Large bytea is TOASTed out-of-line,
-- so these columns never slow reads that don't select them.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.images
  ADD COLUMN IF NOT EXISTS blob_bytes       bytea,
  ADD COLUMN IF NOT EXISTS blob_mime        text,
  ADD COLUMN IF NOT EXISTS blob_size        integer,
  ADD COLUMN IF NOT EXISTS blob_width       integer,
  ADD COLUMN IF NOT EXISTS blob_height      integer,
  ADD COLUMN IF NOT EXISTS blob_etag        text,
  ADD COLUMN IF NOT EXISTS blob_status      text NOT NULL DEFAULT 'pending', -- pending|ok|too_big|error
  ADD COLUMN IF NOT EXISTS blob_captured_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS blob_checked_at  timestamp with time zone;

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS blob_bytes       bytea,
  ADD COLUMN IF NOT EXISTS blob_mime        text,
  ADD COLUMN IF NOT EXISTS blob_size        integer,
  ADD COLUMN IF NOT EXISTS blob_width       integer,
  ADD COLUMN IF NOT EXISTS blob_height      integer,
  ADD COLUMN IF NOT EXISTS blob_etag        text,
  ADD COLUMN IF NOT EXISTS blob_status      text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS blob_captured_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS blob_checked_at  timestamp with time zone;

-- Lookup indexes for the /api/media serving endpoint (keys off the rendered URL).
CREATE INDEX IF NOT EXISTS idx_images_source_url    ON public.images (source_url);
CREATE INDEX IF NOT EXISTS idx_images_cdn_url       ON public.images (cdn_url) WHERE cdn_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_providers_image_url  ON public.providers (image_url);
