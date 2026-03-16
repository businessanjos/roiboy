
CREATE TABLE public.team_insights_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'team',
  member_name text,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_insights_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account insights"
  ON public.team_insights_history FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can insert own account insights"
  ON public.team_insights_history FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can delete own account insights"
  ON public.team_insights_history FOR DELETE
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE INDEX idx_team_insights_history_account_scope ON public.team_insights_history(account_id, scope);
