CREATE OR REPLACE FUNCTION public.process_marketing_task_recurrences(p_today date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE source public.marketing_tasks%ROWTYPE; next_date date; new_id uuid; open_column uuid; n integer := 0; source_n integer := 0; attempts integer := 0; failures integer := 0;
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
    EXIT WHEN attempts >= 200;
    source_n := 0;
    BEGIN
      SELECT c.id INTO open_column FROM public.marketing_task_columns c WHERE c.account_id=source.account_id AND NOT c.is_done
        ORDER BY (c.id=source.column_id) DESC,c.display_order,c.id LIMIT 1;
      next_date := source.recurrence_next_date;
      WHILE next_date <= p_today AND attempts < 200 LOOP
        attempts := attempts+1;
        new_id := NULL;
        INSERT INTO public.marketing_tasks(account_id,section_id,column_id,title,description,assignee_id,due_date,priority,status,tags,custom_fields,media_attachments,display_order,is_completed,completed_at,created_by,recurrence_source_id,recurrence_occurrence_date)
        SELECT source.account_id,source.section_id,open_column,source.title,source.description,source.assignee_id,next_date,source.priority,'pending',source.tags,source.custom_fields,source.media_attachments,
          coalesce((SELECT max(display_order)+1 FROM public.marketing_tasks WHERE account_id=source.account_id AND section_id IS NOT DISTINCT FROM source.section_id),0),false,NULL,source.recurrence_creator_id,source.id,next_date
        ON CONFLICT (recurrence_source_id,recurrence_occurrence_date) WHERE recurrence_source_id IS NOT NULL DO NOTHING RETURNING id INTO new_id;
        IF new_id IS NOT NULL THEN
          INSERT INTO public.marketing_task_subtasks(task_id,account_id,title,assignee_id,due_date,display_order,is_completed,completed_at)
          SELECT new_id,source.account_id,s.title,s.assignee_id,CASE WHEN s.due_date IS NULL THEN NULL ELSE next_date+(s.due_date-source.due_date) END,s.display_order,false,NULL
          FROM public.marketing_task_subtasks s WHERE s.task_id=source.id AND s.account_id=source.account_id;
          source_n := source_n+1;
        END IF;
        next_date := public.marketing_task_recurrence_date(source.recurrence_rule,next_date,false);
      END LOOP;
      UPDATE public.marketing_tasks SET recurrence_next_date=next_date WHERE id=source.id AND account_id=source.account_id;
      n := n+source_n;
    EXCEPTION WHEN OTHERS THEN
      failures := failures+1;
      RAISE WARNING 'Marketing recurrence % failed: %',source.id,SQLSTATE;
    END;
  END LOOP;
  RETURN jsonb_build_object('created',n,'failures',failures);
END; $$;
REVOKE ALL ON FUNCTION public.process_marketing_task_recurrences(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_marketing_task_recurrences(date) TO service_role;