CREATE TABLE public.client_ryka_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  client_id uuid NOT NULL,
  clinic_id text,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  last_login_at timestamptz,
  active_users_7d integer,
  active_users_30d integer,
  users_total integer,
  leads_7d integer,
  leads_30d integer,
  appointments_30d integer,
  consultations_30d integer,
  has_action_plan boolean,
  action_plan_updated_at timestamptz,
  modules_used text[],
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, snapshot_date)
);
GRANT SELECT ON public.client_ryka_usage_daily TO authenticated;
GRANT ALL ON public.client_ryka_usage_daily TO service_role;
ALTER TABLE public.client_ryka_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY ryka_usage_select_same_account ON public.client_ryka_usage_daily FOR SELECT TO authenticated
USING (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()));
CREATE INDEX client_ryka_usage_daily_acc_date ON public.client_ryka_usage_daily(account_id, snapshot_date DESC);