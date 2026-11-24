ALTER TABLE public.marketing_task_comments ADD COLUMN author_name text;
ALTER TABLE public.marketing_task_comments DROP CONSTRAINT marketing_task_comments_user_id_fkey;
CREATE OR REPLACE FUNCTION public.marketing_task_comment_identity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT id, name INTO NEW.user_id, NEW.author_name FROM public.users WHERE auth_user_id = auth.uid();
    IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Authenticated application user required'; END IF;
  END IF;
  SELECT account_id INTO NEW.account_id FROM public.marketing_tasks WHERE id = NEW.task_id;
  NEW.body := btrim(NEW.body);
  NEW.created_at := now();
  RETURN NEW;
END;
$$;