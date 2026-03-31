
-- YouTube Channels (following tiktok_profiles pattern)
CREATE TABLE public.youtube_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  channel_id TEXT NULL,
  username TEXT NOT NULL,
  display_name TEXT NULL,
  profile_picture_url TEXT NULL,
  subscribers_count INTEGER DEFAULT 0,
  subscribers_previous_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  bio TEXT NULL,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- YouTube Videos (following tiktok_posts pattern)
CREATE TABLE public.youtube_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  youtube_id TEXT NULL,
  video_url TEXT NULL,
  title TEXT NULL,
  caption TEXT NULL,
  thumbnail_url TEXT NULL,
  posted_at TIMESTAMPTZ NULL,
  duration_seconds INTEGER NULL,
  video_type TEXT DEFAULT 'video', -- 'video', 'short', 'live'
  views BIGINT DEFAULT 0,
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  avg_watch_time NUMERIC NULL,
  completion_rate NUMERIC NULL,
  engagement_rate NUMERIC NULL,
  followers_gained INTEGER DEFAULT 0,
  is_viral BOOLEAN DEFAULT false,
  hashtags TEXT[] NULL,
  ai_objective TEXT NULL,
  category TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their account youtube channels"
  ON public.youtube_channels FOR ALL
  TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage their account youtube videos"
  ON public.youtube_videos FOR ALL
  TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

-- Indexes
CREATE INDEX idx_youtube_channels_account_id ON public.youtube_channels(account_id);
CREATE INDEX idx_youtube_videos_channel_id ON public.youtube_videos(channel_id);
CREATE INDEX idx_youtube_videos_account_id ON public.youtube_videos(account_id);
CREATE INDEX idx_youtube_videos_posted_at ON public.youtube_videos(posted_at);
