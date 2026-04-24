-- Table to record funnel configuration anomalies detected at runtime.
-- Used to alert admins when a single pipeline contains multiple stages
-- with the same name (which makes funnel charts ambiguous).
CREATE TABLE IF NOT EXISTS public.funnel_config_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  visual_id uuid,
  alert_type text NOT NULL,
  pipeline_id uuid,
  stage_name text,
  duplicate_stage_ids uuid[],
  details jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_config_alerts_account
  ON public.funnel_config_alerts(account_id, resolved, created_at DESC);

-- Prevent flooding: at most one open alert per (account, pipeline, stage_name, alert_type)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_funnel_config_alerts_open
  ON public.funnel_config_alerts(account_id, pipeline_id, stage_name, alert_type)
  WHERE resolved = false;

ALTER TABLE public.funnel_config_alerts ENABLE ROW LEVEL SECURITY;

-- Members of the account can read their alerts
CREATE POLICY "Account members can read funnel alerts"
  ON public.funnel_config_alerts
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- Account members can insert alerts (the hook writes them client-side)
CREATE POLICY "Account members can insert funnel alerts"
  ON public.funnel_config_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- Account members can mark alerts as resolved
CREATE POLICY "Account members can update funnel alerts"
  ON public.funnel_config_alerts
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );