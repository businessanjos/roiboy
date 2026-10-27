CREATE TABLE public.education_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.education_options TO authenticated;
GRANT ALL ON public.education_options TO service_role;
ALTER TABLE public.education_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members view education options" ON public.education_options FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Account members manage education options" ON public.education_options FOR ALL TO authenticated USING (account_id = public.get_current_user_account_id()) WITH CHECK (account_id = public.get_current_user_account_id());
CREATE INDEX ON public.education_options (account_id, name);