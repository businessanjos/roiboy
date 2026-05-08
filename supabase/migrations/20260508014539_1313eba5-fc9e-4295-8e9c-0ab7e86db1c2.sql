ALTER TABLE public.client_instagram_metrics_history
  ADD COLUMN IF NOT EXISTS total_likes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_comments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posts_considered integer DEFAULT 0;