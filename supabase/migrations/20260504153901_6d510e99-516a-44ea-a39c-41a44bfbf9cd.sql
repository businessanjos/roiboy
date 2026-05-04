
-- OAuth states (single-use tokens for Meta OAuth flow)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  redirect_path TEXT NOT NULL DEFAULT '/marketing/trafego-pago',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user ON public.oauth_states(user_id);
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages oauth states" ON public.oauth_states FOR ALL USING (false) WITH CHECK (false);

-- Audit logs (lightweight)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_address TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);

-- User Meta tokens (Facebook/Meta long-lived tokens)
CREATE TABLE IF NOT EXISTS public.user_meta_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  token_type TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  meta_user_id TEXT,
  meta_user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_meta_tokens_meta_user ON public.user_meta_tokens(meta_user_id);
ALTER TABLE public.user_meta_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own meta token" ON public.user_meta_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users delete own meta token" ON public.user_meta_tokens FOR DELETE USING (auth.uid() = user_id);

-- Selected ad accounts per user
CREATE TABLE IF NOT EXISTS public.user_meta_selected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_account_id)
);
CREATE INDEX IF NOT EXISTS idx_user_meta_selected_user ON public.user_meta_selected_accounts(user_id);
ALTER TABLE public.user_meta_selected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own ad accounts" ON public.user_meta_selected_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own ad accounts" ON public.user_meta_selected_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own ad accounts" ON public.user_meta_selected_accounts FOR DELETE USING (auth.uid() = user_id);

-- Marketing ad sets / campaigns synced from Meta
CREATE TABLE IF NOT EXISTS public.marketing_ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  meta_campaign_id TEXT,
  name TEXT NOT NULL,
  platform TEXT DEFAULT 'Meta Ads',
  status TEXT DEFAULT 'paused',
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_ad_sets_user ON public.marketing_ad_sets(user_id);
ALTER TABLE public.marketing_ad_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own ad sets" ON public.marketing_ad_sets FOR SELECT USING (auth.uid() = user_id);

-- Lead Ads page subscriptions
CREATE TABLE IF NOT EXISTS public.leadads_page_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT,
  page_access_token TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_id)
);
CREATE INDEX IF NOT EXISTS idx_leadads_user ON public.leadads_page_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_leadads_page ON public.leadads_page_subscriptions(page_id);
ALTER TABLE public.leadads_page_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own leadads pages" ON public.leadads_page_subscriptions FOR SELECT USING (auth.uid() = user_id);
