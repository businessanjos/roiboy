ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS dashboard_churn_goal numeric(5,2) NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS dashboard_renewal_goal numeric(5,2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS dashboard_nps_goal numeric(5,2) NOT NULL DEFAULT 80;