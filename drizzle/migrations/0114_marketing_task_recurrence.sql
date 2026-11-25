ALTER TABLE public.marketing_tasks
  ADD COLUMN recurrence_rule jsonb,
  ADD COLUMN recurrence_next_date date,
  ADD COLUMN recurrence_author_auth_id uuid,
  ADD COLUMN recurrence_creator_id uuid,
  ADD COLUMN recurrence_source_id uuid,
  ADD COLUMN recurrence_occurrence_date date;
CREATE UNIQUE INDEX marketing_task_recurrence_occurrence ON public.marketing_tasks(recurrence_source_id, recurrence_occurrence_date) WHERE recurrence_source_id IS NOT NULL;
CREATE INDEX marketing_task_recurrence_due ON public.marketing_tasks(recurrence_next_date) WHERE recurrence_rule IS NOT NULL;

CREATE FUNCTION public.marketing_task_recurrence_date(p_rule jsonb, p_from date, p_inclusive boolean DEFAULT false)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE d date := p_from + CASE WHEN p_inclusive THEN 0 ELSE 1 END; candidate date; month_start date;
BEGIN
  IF p_rule->>'frequency' = 'daily' THEN RETURN d; END IF;
  IF p_rule->>'frequency' = 'weekly' THEN
    RETURN d + (((p_rule->>'weekday')::integer - extract(dow FROM d)::integer + 7) % 7);
  END IF;
  IF p_rule->>'frequency' = 'monthly' THEN
    month_start := date_trunc('month', d)::date;
    candidate := month_start + (least((p_rule->>'month_day')::integer, extract(day FROM month_start + interval '1 month - 1 day')::integer) - 1);
    IF candidate < d THEN
      month_start := (month_start + interval '1 month')::date;
      candidate := month_start + (least((p_rule->>'month_day')::integer, extract(day FROM month_start + interval '1 month - 1 day')::integer) - 1);
    END IF;
    RETURN candidate;
  END IF;
  RAISE EXCEPTION 'Repetição inválida';
END; $$;
REVOKE ALL ON FUNCTION public.marketing_task_recurrence_date(jsonb,date,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_task_recurrence_date(jsonb,date,boolean) TO authenticated, service_role;

CREATE FUNCTION public.validate_marketing_task_recurrence() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE changed boolean; actor uuid; last_date date;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.recurrence_source_id IS NOT NULL OR NEW.recurrence_occurrence_date IS NOT NULL THEN
      RAISE EXCEPTION 'Ocorrências são criadas automaticamente';
    END IF;
    NEW.recurrence_next_date := NULL; NEW.recurrence_author_auth_id := NULL; NEW.recurrence_creator_id := NULL;
    changed := NEW.recurrence_rule IS NOT NULL;
  ELSE
    NEW.recurrence_next_date := OLD.recurrence_next_date;
    NEW.recurrence_author_auth_id := OLD.recurrence_author_auth_id;
    NEW.recurrence_creator_id := OLD.recurrence_creator_id;
    NEW.recurrence_source_id := OLD.recurrence_source_id;
    NEW.recurrence_occurrence_date := OLD.recurrence_occurrence_date;
    changed := NEW.recurrence_rule IS DISTINCT FROM OLD.recurrence_rule
      OR (NEW.recurrence_rule IS NOT NULL AND NEW.due_date IS DISTINCT FROM OLD.due_date);
  END IF;
  IF NOT changed THEN RETURN NEW; END IF;
  IF NEW.recurrence_source_id IS NOT NULL THEN RAISE EXCEPTION 'Edite a repetição na tarefa original'; END IF;
  IF NEW.recurrence_rule IS NULL THEN NEW.recurrence_next_date := NULL; RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NEW.account_id IS DISTINCT FROM public.get_my_account_id() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT id INTO actor FROM public.users WHERE auth_user_id = auth.uid() AND account_id = NEW.account_id AND is_active IS DISTINCT FROM false LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF jsonb_typeof(NEW.recurrence_rule) IS DISTINCT FROM 'object' OR NEW.due_date IS NULL OR
    NOT (NEW.recurrence_rule->>'frequency' = 'daily'
      OR (NEW.recurrence_rule->>'frequency' = 'weekly' AND coalesce(NEW.recurrence_rule->>'weekday','') ~ '^[0-6]$')
      OR (NEW.recurrence_rule->>'frequency' = 'monthly' AND coalesce(NEW.recurrence_rule->>'month_day','') ~ '^([1-9]|[12][0-9]|3[01])$')) IS TRUE THEN
    RAISE EXCEPTION 'Informe uma repetição válida e a primeira data de entrega';
  END IF;
  IF NEW.due_date IS DISTINCT FROM public.marketing_task_recurrence_date(NEW.recurrence_rule,NEW.due_date,true) THEN
    RAISE EXCEPTION 'A entrega deve coincidir com o dia escolhido para repetição';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.assignee_id AND account_id = NEW.account_id AND is_active IS DISTINCT FROM false
    AND id NOT IN ('4cd93864-3689-4835-bddf-91e2960e7860'::uuid,'4385080f-e707-460f-b7ab-489fa3f73150'::uuid)) THEN
    RAISE EXCEPTION 'Selecione um responsável ativo da sua conta';
  END IF;
  SELECT max(recurrence_occurrence_date) INTO last_date FROM public.marketing_tasks WHERE recurrence_source_id=NEW.id AND account_id=NEW.account_id;
  NEW.recurrence_next_date := public.marketing_task_recurrence_date(NEW.recurrence_rule,greatest(NEW.due_date,(now() AT TIME ZONE 'America/Sao_Paulo')::date,last_date),false);
  NEW.recurrence_author_auth_id := auth.uid(); NEW.recurrence_creator_id := actor;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_marketing_task_recurrence() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER marketing_task_recurrence_validate BEFORE INSERT OR UPDATE ON public.marketing_tasks FOR EACH ROW EXECUTE FUNCTION public.validate_marketing_task_recurrence();

CREATE FUNCTION public.process_marketing_task_recurrences(p_today date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE source public.marketing_tasks%ROWTYPE; next_date date; new_id uuid; open_column uuid; n integer := 0; failures integer := 0;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_today IS NULL THEN RAISE EXCEPTION 'Data inválida'; END IF;
  FOR source IN SELECT t.* FROM public.marketing_tasks t
    WHERE t.recurrence_rule IS NOT NULL AND t.recurrence_next_date <= p_today AND t.recurrence_source_id IS NULL
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id=t.recurrence_creator_id AND u.auth_user_id=t.recurrence_author_auth_id AND u.account_id=t.account_id AND u.is_active IS DISTINCT FROM false)
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id=t.assignee_id AND u.account_id=t.account_id AND u.is_active IS DISTINCT FROM false AND u.auth_user_id IS NOT NULL
        AND u.id NOT IN ('4cd93864-3689-4835-bddf-91e2960e7860'::uuid,'4385080f-e707-460f-b7ab-489fa3f73150'::uuid))
    ORDER BY t.recurrence_next_date,t.id LIMIT 200 FOR UPDATE OF t SKIP LOCKED
  LOOP
    EXIT WHEN n >= 200;
    BEGIN
      SELECT c.id INTO open_column FROM public.marketing_task_columns c WHERE c.account_id=source.account_id AND NOT c.is_done
        ORDER BY (c.id=source.column_id) DESC,c.display_order,c.id LIMIT 1;
      next_date := source.recurrence_next_date;
      WHILE next_date <= p_today AND n < 200 LOOP
        new_id := NULL;
        INSERT INTO public.marketing_tasks(account_id,section_id,column_id,title,description,assignee_id,due_date,priority,status,tags,custom_fields,media_attachments,display_order,is_completed,completed_at,created_by,recurrence_source_id,recurrence_occurrence_date)
        SELECT source.account_id,source.section_id,open_column,source.title,source.description,source.assignee_id,next_date,source.priority,'pending',source.tags,source.custom_fields,source.media_attachments,
          coalesce((SELECT max(display_order)+1 FROM public.marketing_tasks WHERE account_id=source.account_id AND section_id IS NOT DISTINCT FROM source.section_id),0),false,NULL,source.recurrence_creator_id,source.id,next_date
        ON CONFLICT (recurrence_source_id,recurrence_occurrence_date) WHERE recurrence_source_id IS NOT NULL DO NOTHING RETURNING id INTO new_id;
        IF new_id IS NOT NULL THEN
          INSERT INTO public.marketing_task_subtasks(task_id,account_id,title,assignee_id,due_date,display_order,is_completed,completed_at)
          SELECT new_id,source.account_id,s.title,s.assignee_id,CASE WHEN s.due_date IS NULL THEN NULL ELSE next_date+(s.due_date-source.due_date) END,s.display_order,false,NULL
          FROM public.marketing_task_subtasks s WHERE s.task_id=source.id AND s.account_id=source.account_id;
          n := n+1;
        END IF;
        next_date := public.marketing_task_recurrence_date(source.recurrence_rule,next_date,false);
      END LOOP;
      UPDATE public.marketing_tasks SET recurrence_next_date=next_date WHERE id=source.id AND account_id=source.account_id;
    EXCEPTION WHEN OTHERS THEN
      failures := failures+1;
      RAISE WARNING 'Marketing recurrence % failed: %',source.id,SQLSTATE;
    END;
  END LOOP;
  RETURN jsonb_build_object('created',n,'failures',failures);
END; $$;
REVOKE ALL ON FUNCTION public.process_marketing_task_recurrences(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_marketing_task_recurrences(date) TO service_role;
COMMENT ON COLUMN public.marketing_tasks.recurrence_rule IS 'Calendar repetition configured only on the original task; null stops future occurrences. Existing task RLS is unchanged.';
COMMENT ON COLUMN public.marketing_tasks.recurrence_author_auth_id IS 'Server-stamped auth identity of the person who last configured recurrence.';
COMMENT ON COLUMN public.marketing_tasks.recurrence_source_id IS 'Original recurring task UUID; no cascade deletion so occurrence history survives source deletion.';