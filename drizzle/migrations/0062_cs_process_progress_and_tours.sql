CREATE TABLE public.user_tour_views (
  user_id uuid NOT NULL,
  tour_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tour_views TO authenticated;
GRANT ALL ON public.user_tour_views TO service_role;
ALTER TABLE public.user_tour_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tour views" ON public.user_tour_views FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.cs_process_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  process_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('client','event')),
  target_id uuid NOT NULL,
  step_key text NOT NULL,
  done_by uuid DEFAULT auth.uid(),
  done_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, process_id, target_type, target_id, step_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_process_progress TO authenticated;
GRANT ALL ON public.cs_process_progress TO service_role;
ALTER TABLE public.cs_process_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account progress" ON public.cs_process_progress FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());