-- Create TikTok profiles table
CREATE TABLE public.tiktok_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,
  followers_previous_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  bio TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create TikTok posts table
CREATE TABLE public.tiktok_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.tiktok_profiles(id) ON DELETE CASCADE,
  tiktok_id TEXT,
  video_url TEXT,
  caption TEXT,
  thumbnail_url TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  avg_watch_time NUMERIC(10,2),
  completion_rate NUMERIC(5,2),
  engagement_rate NUMERIC(5,2),
  followers_gained INTEGER DEFAULT 0,
  is_viral BOOLEAN DEFAULT false,
  sound_name TEXT,
  hashtags TEXT[],
  ai_objective TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create TikTok credentials table
CREATE TABLE public.tiktok_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.tiktok_profiles(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create TikTok insights table
CREATE TABLE public.tiktok_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.tiktok_profiles(id) ON DELETE CASCADE,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  followers_count INTEGER,
  following_count INTEGER,
  videos_count INTEGER,
  likes_count INTEGER,
  profile_views INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create TikTok post options table
CREATE TABLE public.tiktok_post_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  option_type TEXT NOT NULL,
  value TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tiktok_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_post_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tiktok_profiles using users table
CREATE POLICY "Users can view their account's TikTok profiles"
ON public.tiktok_profiles FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert TikTok profiles for their account"
ON public.tiktok_profiles FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their account's TikTok profiles"
ON public.tiktok_profiles FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their account's TikTok profiles"
ON public.tiktok_profiles FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for tiktok_posts
CREATE POLICY "Users can view their account's TikTok posts"
ON public.tiktok_posts FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert TikTok posts for their account"
ON public.tiktok_posts FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their account's TikTok posts"
ON public.tiktok_posts FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their account's TikTok posts"
ON public.tiktok_posts FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for tiktok_credentials
CREATE POLICY "Users can view their account's TikTok credentials"
ON public.tiktok_credentials FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert TikTok credentials for their account"
ON public.tiktok_credentials FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their account's TikTok credentials"
ON public.tiktok_credentials FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their account's TikTok credentials"
ON public.tiktok_credentials FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for tiktok_insights
CREATE POLICY "Users can view their account's TikTok insights"
ON public.tiktok_insights FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert TikTok insights for their account"
ON public.tiktok_insights FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for tiktok_post_options
CREATE POLICY "Users can view their account's TikTok post options"
ON public.tiktok_post_options FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert TikTok post options for their account"
ON public.tiktok_post_options FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their account's TikTok post options"
ON public.tiktok_post_options FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their account's TikTok post options"
ON public.tiktok_post_options FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_tiktok_profiles_account_id ON public.tiktok_profiles(account_id);
CREATE INDEX idx_tiktok_posts_profile_id ON public.tiktok_posts(profile_id);
CREATE INDEX idx_tiktok_posts_account_id ON public.tiktok_posts(account_id);
CREATE INDEX idx_tiktok_posts_posted_at ON public.tiktok_posts(posted_at);
CREATE INDEX idx_tiktok_insights_profile_id ON public.tiktok_insights(profile_id);
CREATE INDEX idx_tiktok_post_options_account_id ON public.tiktok_post_options(account_id);

-- Create trigger for updated_at on tiktok_profiles
CREATE TRIGGER update_tiktok_profiles_updated_at
BEFORE UPDATE ON public.tiktok_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on tiktok_posts
CREATE TRIGGER update_tiktok_posts_updated_at
BEFORE UPDATE ON public.tiktok_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on tiktok_credentials
CREATE TRIGGER update_tiktok_credentials_updated_at
BEFORE UPDATE ON public.tiktok_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on tiktok_post_options
CREATE TRIGGER update_tiktok_post_options_updated_at
BEFORE UPDATE ON public.tiktok_post_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();