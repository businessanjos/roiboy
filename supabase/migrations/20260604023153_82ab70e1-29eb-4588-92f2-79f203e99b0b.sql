
ALTER TABLE public.marketing_ad_sets
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text;

CREATE INDEX IF NOT EXISTS idx_marketing_ad_sets_meta_account
  ON public.marketing_ad_sets(meta_ad_account_id);

-- Garante unicidade lógica por (user, ad_account, campaign) para upserts
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ad_sets_user_account_campaign
  ON public.marketing_ad_sets(user_id, meta_ad_account_id, meta_campaign_id)
  WHERE meta_campaign_id IS NOT NULL;
