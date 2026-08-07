CREATE TABLE IF NOT EXISTS public.agency_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  agency_id uuid NOT NULL REFERENCES public.traffic_agencies(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  -- moeda
  spend numeric NOT NULL DEFAULT 0,
  cpl numeric,
  cost_per_mql numeric,
  cpm numeric,
  -- absolutos
  impressions integer NOT NULL DEFAULT 0,
  link_clicks integer NOT NULL DEFAULT 0,
  page_views integer NOT NULL DEFAULT 0,
  leads_total integer NOT NULL DEFAULT 0,
  leads_mql integer NOT NULL DEFAULT 0,
  -- percentuais (0-100)
  ctr numeric,
  connect_rate numeric,
  mql_rate numeric,
  lp_conversion_rate numeric,
  -- melhor criativo
  best_creative_name text,
  best_creative_spend numeric,
  best_creative_mqls integer,
  best_creative_cpa numeric,
  best_creative_url text,
  best_creative_notes text,
  -- textos
  comparison_notes text,
  evolution_notes text,
  bottleneck_notes text,
  team_actions text,
  client_dependencies text,
  summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_awr_agency_week ON public.agency_weekly_reports(agency_id, week_start DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_weekly_reports TO authenticated;
GRANT ALL ON public.agency_weekly_reports TO service_role;

ALTER TABLE public.agency_weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account read weekly reports"
  ON public.agency_weekly_reports FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "account insert weekly reports"
  ON public.agency_weekly_reports FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "account update weekly reports"
  ON public.agency_weekly_reports FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "account delete weekly reports"
  ON public.agency_weekly_reports FOR DELETE TO authenticated
  USING (account_id = public.get_current_user_account_id());

DROP TRIGGER IF EXISTS set_updated_at ON public.agency_weekly_reports;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.agency_weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();