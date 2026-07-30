CREATE TABLE public.social_manual_weekly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'instagram',
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  week int NOT NULL CHECK (week BETWEEN 1 AND 5),
  views bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  interactions bigint NOT NULL DEFAULT 0,
  followers bigint NOT NULL DEFAULT 0,
  profile_visits bigint NOT NULL DEFAULT 0,
  link_clicks bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, year, month, week)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_manual_weekly_metrics TO authenticated;
GRANT ALL ON public.social_manual_weekly_metrics TO service_role;
ALTER TABLE public.social_manual_weekly_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own account manual metrics" ON public.social_manual_weekly_metrics FOR SELECT TO authenticated USING (account_id = get_my_account_id());
CREATE POLICY "insert own account manual metrics" ON public.social_manual_weekly_metrics FOR INSERT TO authenticated WITH CHECK (account_id = get_my_account_id());
CREATE POLICY "update own account manual metrics" ON public.social_manual_weekly_metrics FOR UPDATE TO authenticated USING (account_id = get_my_account_id());
CREATE POLICY "delete own account manual metrics" ON public.social_manual_weekly_metrics FOR DELETE TO authenticated USING (account_id = get_my_account_id());
CREATE TRIGGER smwm_updated_at BEFORE UPDATE ON public.social_manual_weekly_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_smwm_lookup ON public.social_manual_weekly_metrics (account_id, year, month, profile_id);