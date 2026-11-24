CREATE TABLE public.marketing_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.marketing_task_comments TO authenticated;
GRANT ALL ON public.marketing_task_comments TO service_role;
ALTER TABLE public.marketing_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_comments_read ON public.marketing_task_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id = task_id AND t.account_id = marketing_task_comments.account_id));
CREATE POLICY task_comments_create ON public.marketing_task_comments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id = task_id AND t.account_id = marketing_task_comments.account_id) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = auth.uid()));
CREATE POLICY task_comments_delete_own ON public.marketing_task_comments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id = task_id AND t.account_id = marketing_task_comments.account_id) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_user_id = auth.uid()));
CREATE INDEX marketing_task_comments_task_time ON public.marketing_task_comments(task_id, created_at, id);
CREATE FUNCTION public.marketing_task_comment_identity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO NEW.user_id FROM public.users WHERE auth_user_id = auth.uid();
    IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Authenticated application user required'; END IF;
  END IF;
  SELECT account_id INTO NEW.account_id FROM public.marketing_tasks WHERE id = NEW.task_id;
  NEW.body := btrim(NEW.body);
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER marketing_task_comment_identity_before_insert BEFORE INSERT ON public.marketing_task_comments FOR EACH ROW EXECUTE FUNCTION public.marketing_task_comment_identity();

CREATE TABLE public.marketing_task_separators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  column_id uuid NOT NULL REFERENCES public.marketing_task_columns(id) ON DELETE CASCADE,
  before_task_id uuid REFERENCES public.marketing_tasks(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  display_order double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_task_separators TO authenticated;
GRANT ALL ON public.marketing_task_separators TO service_role;
ALTER TABLE public.marketing_task_separators ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_separators_read ON public.marketing_task_separators FOR SELECT TO authenticated USING (account_id = public.get_my_account_id() OR public.is_super_admin() OR public.is_account_owner());
CREATE POLICY task_separators_create ON public.marketing_task_separators FOR INSERT TO authenticated WITH CHECK ((account_id = public.get_my_account_id() OR public.is_super_admin() OR public.is_account_owner()) AND EXISTS (SELECT 1 FROM public.marketing_task_columns c WHERE c.id = column_id AND c.account_id = marketing_task_separators.account_id) AND (before_task_id IS NULL OR EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id = before_task_id AND t.account_id = marketing_task_separators.account_id AND (t.column_id = marketing_task_separators.column_id OR t.column_id IS NULL))));
CREATE POLICY task_separators_update ON public.marketing_task_separators FOR UPDATE TO authenticated USING (account_id = public.get_my_account_id() OR public.is_super_admin() OR public.is_account_owner()) WITH CHECK ((account_id = public.get_my_account_id() OR public.is_super_admin() OR public.is_account_owner()) AND EXISTS (SELECT 1 FROM public.marketing_task_columns c WHERE c.id = column_id AND c.account_id = marketing_task_separators.account_id) AND (before_task_id IS NULL OR EXISTS (SELECT 1 FROM public.marketing_tasks t WHERE t.id = before_task_id AND t.account_id = marketing_task_separators.account_id AND (t.column_id = marketing_task_separators.column_id OR t.column_id IS NULL))));
CREATE POLICY task_separators_delete ON public.marketing_task_separators FOR DELETE TO authenticated USING (account_id = public.get_my_account_id() OR public.is_super_admin() OR public.is_account_owner());
CREATE INDEX marketing_task_separators_column ON public.marketing_task_separators(account_id, column_id, display_order);

CREATE POLICY marketing_task_files_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'marketing-task-files' AND ((storage.foldername(name))[1] = public.get_my_account_id()::text OR public.is_super_admin() OR public.is_account_owner()));
CREATE POLICY marketing_task_files_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marketing-task-files' AND (storage.foldername(name))[1] = public.get_my_account_id()::text);
CREATE POLICY marketing_task_files_delete_own ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'marketing-task-files' AND (storage.foldername(name))[1] = public.get_my_account_id()::text AND owner_id = auth.uid()::text);