-- Add calendar/scheduling fields to marketing_ideas
ALTER TABLE public.marketing_ideas
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS publish_platform text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_url text;

CREATE INDEX IF NOT EXISTS idx_marketing_ideas_scheduled
  ON public.marketing_ideas (account_id, scheduled_for)
  WHERE scheduled_for IS NOT NULL;

-- Apify trend metadata: extend marketing_trends with media + creator data
ALTER TABLE public.marketing_trends
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS creator_handle text,
  ADD COLUMN IF NOT EXISTS creator_followers integer,
  ADD COLUMN IF NOT EXISTS views_count bigint,
  ADD COLUMN IF NOT EXISTS likes_count bigint,
  ADD COLUMN IF NOT EXISTS comments_count bigint,
  ADD COLUMN IF NOT EXISTS audio_title text,
  ADD COLUMN IF NOT EXISTS platform text;