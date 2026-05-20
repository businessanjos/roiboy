
-- Contas conectadas (talent × plataforma)
CREATE TABLE public.content_platform_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  talent_id UUID NOT NULL REFERENCES public.content_talents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram','youtube','tiktok','threads','linkedin','pinterest','spotify')),
  handle TEXT,
  external_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  extra JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','error','revoked')),
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (talent_id, platform)
);

ALTER TABLE public.content_platform_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpa_select ON public.content_platform_accounts FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpa_insert ON public.content_platform_accounts FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpa_update ON public.content_platform_accounts FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpa_delete ON public.content_platform_accounts FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Posts reais por plataforma
CREATE TABLE public.content_platform_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  talent_id UUID NOT NULL REFERENCES public.content_talents(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES public.content_platform_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  media_type TEXT,
  published_at TIMESTAMPTZ,
  pillar_id UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL,
  piece_id UUID REFERENCES public.content_pieces(id) ON DELETE SET NULL,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_account_id, external_id)
);

ALTER TABLE public.content_platform_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpp_select ON public.content_platform_posts FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpp_insert ON public.content_platform_posts FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpp_update ON public.content_platform_posts FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpp_delete ON public.content_platform_posts FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE INDEX idx_cpp_talent_platform_published ON public.content_platform_posts (talent_id, platform, published_at DESC);

-- Métricas por post (snapshot mais recente; histórico opcional via collected_at)
CREATE TABLE public.content_platform_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.content_platform_posts(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  views BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,
  avg_watch_seconds NUMERIC,
  watch_through_rate NUMERIC,
  engagement_rate NUMERIC,
  raw JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.content_platform_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpm_select ON public.content_platform_metrics FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpm_insert ON public.content_platform_metrics FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpm_update ON public.content_platform_metrics FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpm_delete ON public.content_platform_metrics FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE INDEX idx_cpm_post_collected ON public.content_platform_metrics (post_id, collected_at DESC);

-- Snapshot diário de canal (followers, totais)
CREATE TABLE public.content_platform_metric_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  platform_account_id UUID NOT NULL REFERENCES public.content_platform_accounts(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.content_talents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  followers BIGINT,
  total_views BIGINT,
  total_engagement BIGINT,
  profile_visits BIGINT,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_account_id, snapshot_date)
);

ALTER TABLE public.content_platform_metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpms_select ON public.content_platform_metric_snapshots FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpms_insert ON public.content_platform_metric_snapshots FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpms_update ON public.content_platform_metric_snapshots FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY cpms_delete ON public.content_platform_metric_snapshots FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Trigger updated_at
CREATE TRIGGER trg_cpa_updated BEFORE UPDATE ON public.content_platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cpp_updated BEFORE UPDATE ON public.content_platform_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
