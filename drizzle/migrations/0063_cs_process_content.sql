CREATE TABLE public.cs_process_content (
  account_id uuid PRIMARY KEY,
  content text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_process_content TO authenticated;
GRANT ALL ON public.cs_process_content TO service_role;
ALTER TABLE public.cs_process_content ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_cs_process_editor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid()
    AND (u.role::text IN ('admin','super_admin','head','gestor','leader') OR COALESCE(u.is_also_admin,false)))
$$;
CREATE POLICY "read account content" ON public.cs_process_content FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "managers write content" ON public.cs_process_content FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.is_cs_process_editor())
  WITH CHECK (account_id = public.get_current_user_account_id() AND public.is_cs_process_editor());