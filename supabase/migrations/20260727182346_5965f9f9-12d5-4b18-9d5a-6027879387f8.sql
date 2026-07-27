CREATE TABLE IF NOT EXISTS public.marketing_ad_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  agency_id uuid,
  meta_ad_account_id text NOT NULL,
  meta_campaign_id text NOT NULL,
  campaign_name text,
  platform text NOT NULL DEFAULT 'Meta Ads',
  stat_date date NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  conversions bigint NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ad_daily_stats
  ON public.marketing_ad_daily_stats (user_id, meta_ad_account_id, meta_campaign_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_ad_daily_stats_date ON public.marketing_ad_daily_stats (stat_date);
CREATE INDEX IF NOT EXISTS idx_ad_daily_stats_account ON public.marketing_ad_daily_stats (account_id);

GRANT SELECT ON public.marketing_ad_daily_stats TO authenticated;
GRANT ALL ON public.marketing_ad_daily_stats TO service_role;

ALTER TABLE public.marketing_ad_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view ad daily stats account or agency"
ON public.marketing_ad_daily_stats FOR SELECT TO authenticated
USING (
  ((account_id = public.get_current_user_account_id()) AND (public.get_current_user_agency_id() IS NULL))
  OR ((agency_id IS NOT NULL) AND (agency_id = public.get_current_user_agency_id()))
  OR (auth.uid() = user_id)
);

CREATE TRIGGER trg_ad_daily_stats_updated_at
BEFORE UPDATE ON public.marketing_ad_daily_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();