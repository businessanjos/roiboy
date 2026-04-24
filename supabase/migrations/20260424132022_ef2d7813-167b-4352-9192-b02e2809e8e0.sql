ALTER TABLE public.insights_dashboard_shares
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_insights_dashboard_shares_share_token
  ON public.insights_dashboard_shares(share_token);

CREATE INDEX IF NOT EXISTS idx_insights_dashboard_shares_expires_at
  ON public.insights_dashboard_shares(expires_at)
  WHERE expires_at IS NOT NULL;