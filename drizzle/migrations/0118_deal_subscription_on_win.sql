ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_subscription boolean,
  ADD COLUMN IF NOT EXISTS subscription_cycle text;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_subscription_cycle_check
  CHECK (
    subscription_cycle IS NULL
    OR (is_subscription IS TRUE AND subscription_cycle IN ('monthly', 'annual'))
  );

COMMENT ON COLUMN public.deals.is_subscription IS 'Answer to "É uma assinatura?" given at win time; null = not asked.';
COMMENT ON COLUMN public.deals.subscription_cycle IS 'monthly | annual, only when is_subscription is true.';

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS requires_subscription_on_win boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.companies.requires_subscription_on_win IS 'When true, winning a deal of this company requires the subscription answer.';

UPDATE public.companies
SET requires_subscription_on_win = true
WHERE id = 'eb4c9184-ffea-4995-923f-b0a9b857c2e3';