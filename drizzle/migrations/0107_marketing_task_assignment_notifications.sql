CREATE FUNCTION public.notify_marketing_task_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor public.users%ROWTYPE;
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN RETURN NEW; END IF;
  END IF;

  -- Session identity is authoritative. Background inserts may use the recorded creator;
  -- background transfers never impersonate the task's original creator.
  IF auth.uid() IS NOT NULL THEN
    SELECT * INTO v_actor FROM public.users WHERE auth_user_id = auth.uid() AND account_id = NEW.account_id LIMIT 1;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT * INTO v_actor FROM public.users WHERE id = NEW.created_by AND account_id = NEW.account_id;
  END IF;

  INSERT INTO public.notifications(account_id,user_id,type,title,content,link,source_type,source_id,triggered_by_user_id,sector_id)
  SELECT NEW.account_id,u.id,'task_assigned',
    CASE WHEN v_actor.id IS NOT NULL THEN split_part(btrim(coalesce(nullif(v_actor.name,''),'Alguém')), ' ', 1) || ' atribuiu uma tarefa a você' ELSE 'Uma tarefa foi atribuída a você' END,
    left(NEW.title,200),
    '/marketing/projetos?tab=tarefas&task=' || NEW.id::text,
    'marketing_task_assignment',NEW.id,v_actor.id,'marketing'
  FROM public.users u
  WHERE u.id=NEW.assignee_id AND u.account_id=NEW.account_id
    AND u.id IS DISTINCT FROM v_actor.id
    AND u.is_active IS DISTINCT FROM false AND u.auth_user_id IS NOT NULL
    AND u.id NOT IN ('4cd93864-3689-4835-bddf-91e2960e7860'::uuid, '4385080f-e707-460f-b7ab-489fa3f73150'::uuid)
    AND lower(coalesce(u.email,'')) NOT IN ('tv-escritorio@iamroy.app','anjosgroup.dados@anjosbusiness.com');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_marketing_task_assignment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER marketing_task_assignment_notify AFTER INSERT OR UPDATE OF assignee_id ON public.marketing_tasks FOR EACH ROW EXECUTE FUNCTION public.notify_marketing_task_assignment();