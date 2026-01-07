-- Tabela para perfis do Instagram
CREATE TABLE public.instagram_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,
  followers_previous_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  bio TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para credenciais de acesso
CREATE TABLE public.instagram_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.instagram_profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'bearer',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para posts do Instagram
CREATE TABLE public.instagram_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.instagram_profiles(id) ON DELETE CASCADE,
  instagram_id TEXT,
  post_type TEXT NOT NULL CHECK (post_type IN ('reels', 'carousel', 'static')),
  caption TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  virality_rate NUMERIC(5,2) DEFAULT 0,
  ai_objective TEXT CHECK (ai_objective IN ('growth', 'connection', 'authority', 'sales')),
  ai_objective_confidence NUMERIC(5,2),
  is_trending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_instagram_profiles_account_id ON public.instagram_profiles(account_id);
CREATE INDEX idx_instagram_posts_profile_id ON public.instagram_posts(profile_id);
CREATE INDEX idx_instagram_posts_posted_at ON public.instagram_posts(posted_at DESC);

-- Enable RLS
ALTER TABLE public.instagram_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instagram_profiles
CREATE POLICY "Users can view their account instagram profiles"
  ON public.instagram_profiles FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert instagram profiles for their account"
  ON public.instagram_profiles FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their account instagram profiles"
  ON public.instagram_profiles FOR UPDATE
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their account instagram profiles"
  ON public.instagram_profiles FOR DELETE
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- RLS Policies for instagram_credentials
CREATE POLICY "Users can view credentials of their profiles"
  ON public.instagram_credentials FOR SELECT
  USING (profile_id IN (
    SELECT id FROM public.instagram_profiles 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can insert credentials for their profiles"
  ON public.instagram_credentials FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM public.instagram_profiles 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can update credentials of their profiles"
  ON public.instagram_credentials FOR UPDATE
  USING (profile_id IN (
    SELECT id FROM public.instagram_profiles 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can delete credentials of their profiles"
  ON public.instagram_credentials FOR DELETE
  USING (profile_id IN (
    SELECT id FROM public.instagram_profiles 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  ));

-- RLS Policies for instagram_posts
CREATE POLICY "Users can view posts of their profiles"
  ON public.instagram_posts FOR SELECT
  USING (profile_id IN (
    SELECT id FROM public.instagram_profiles 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can insert posts for their profiles"
  ON public.instagram_posts FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM public.instagram_profiles 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can update posts of their profiles"
  ON public.instagram_posts FOR UPDATE
  USING (profile_id IN (
    SELECT id FROM public.instagram_profiles 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can delete posts of their profiles"
  ON public.instagram_posts FOR DELETE
  USING (profile_id IN (
    SELECT id FROM public.instagram_profiles 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())
  ));

-- Triggers para updated_at
CREATE TRIGGER update_instagram_profiles_updated_at
  BEFORE UPDATE ON public.instagram_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instagram_posts_updated_at
  BEFORE UPDATE ON public.instagram_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();