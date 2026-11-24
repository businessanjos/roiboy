CREATE UNIQUE INDEX marketing_task_comment_notification_recipient ON public.notifications(source_id,user_id) WHERE source_type = 'marketing_task_comment';

CREATE FUNCTION public.marketing_task_mention_key(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT lower(translate(split_part(btrim(coalesce(value,'')), ' ', 1), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'));
$$;
REVOKE ALL ON FUNCTION public.marketing_task_mention_key(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.notify_marketing_task_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_task public.marketing_tasks%ROWTYPE;
  v_actor public.users%ROWTYPE;
  v_payload jsonb;
  v_doc jsonb;
  v_text text := NEW.body;
  v_mentions uuid[] := '{}'::uuid[];
  v_extra uuid[] := '{}'::uuid[];
  v_labels text[] := '{}'::text[];
BEGIN
  SELECT * INTO v_task FROM public.marketing_tasks WHERE id = NEW.task_id AND account_id = NEW.account_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO v_actor FROM public.users WHERE id = NEW.user_id AND account_id = v_task.account_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF left(NEW.body, length('ROY_TASK_COMMENT_V1:')) = 'ROY_TASK_COMMENT_V1:' THEN
    BEGIN
      v_payload := substring(NEW.body FROM length('ROY_TASK_COMMENT_V1:') + 1)::jsonb;
      IF jsonb_typeof(v_payload->'text') = 'string' THEN v_text := v_payload->>'text'; END IF;
      IF v_payload->'document'->>'type' = 'doc' THEN v_doc := v_payload->'document'; END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      v_text := NEW.body;
    END;
  END IF;

  WITH RECURSIVE nodes(node, depth) AS (
    SELECT v_doc, 0
    UNION ALL
    SELECT child.value, n.depth + 1 FROM nodes n
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN n.depth < 15 AND n.node->>'type' IN ('doc','paragraph','bulletList','orderedList','listItem') AND jsonb_typeof(n.node->'content') = 'array' THEN n.node->'content' ELSE '[]'::jsonb END) child
  )
  SELECT coalesce(array_agg(DISTINCT (node->'attrs'->>'id')::uuid), '{}'::uuid[]), coalesce(array_agg(DISTINCT public.marketing_task_mention_key(node->'attrs'->>'label')), '{}'::text[])
  INTO v_mentions, v_labels FROM nodes
  WHERE node->>'type' = 'mention' AND node->'attrs'->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  -- A typed @first-name is resolved only when it identifies exactly one eligible person.
  WITH typed_names AS (
    SELECT DISTINCT public.marketing_task_mention_key(m[2]) AS name FROM regexp_matches(v_text, '(^|[[:space:](])@([[:alnum:]_]+)', 'g') m
  ), eligible AS (
    SELECT u.id, public.marketing_task_mention_key(u.name) AS name FROM public.users u
    WHERE u.account_id = v_task.account_id AND u.is_active IS DISTINCT FROM false AND u.auth_user_id IS NOT NULL
      AND u.id NOT IN ('4cd93864-3689-4835-bddf-91e2960e7860'::uuid, '4385080f-e707-460f-b7ab-489fa3f73150'::uuid)
      AND lower(coalesce(u.email,'')) NOT IN ('tv-escritorio@iamroy.app','anjosgroup.dados@anjosbusiness.com')
      AND EXISTS (SELECT 1 FROM public.user_sector_access a WHERE a.user_id=u.id AND a.account_id=v_task.account_id AND a.sector_id='marketing' AND a.is_active=true)
  ), unique_names AS (
    SELECT e.name, (array_agg(e.id))[1] AS id FROM eligible e JOIN typed_names t ON t.name=e.name
    WHERE NOT (e.name = ANY(v_labels)) GROUP BY e.name HAVING count(*)=1
  ) SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO v_extra FROM unique_names;
  v_mentions := v_mentions || v_extra;

  INSERT INTO public.notifications(account_id,user_id,type,title,content,link,source_type,source_id,triggered_by_user_id,sector_id)
  SELECT v_task.account_id,u.id,
    CASE WHEN u.id=ANY(v_mentions) THEN 'mention' ELSE 'task_comment' END,
    split_part(btrim(coalesce(nullif(v_actor.name,''),'Alguém')), ' ', 1) || CASE WHEN u.id=ANY(v_mentions) THEN ' te mencionou na tarefa' ELSE ' comentou na sua tarefa' END,
    left(v_task.title,200) || E'\n' || left(regexp_replace(v_text, '[[:space:]]+', ' ', 'g'),180),
    '/marketing/projetos?tab=tarefas&task=' || v_task.id::text || '&comment=' || NEW.id::text,
    'marketing_task_comment',NEW.id,v_actor.id,'marketing'
  FROM public.users u
  WHERE u.account_id=v_task.account_id AND u.id<>v_actor.id AND u.is_active IS DISTINCT FROM false AND u.auth_user_id IS NOT NULL
    AND u.id NOT IN ('4cd93864-3689-4835-bddf-91e2960e7860'::uuid, '4385080f-e707-460f-b7ab-489fa3f73150'::uuid)
    AND lower(coalesce(u.email,'')) NOT IN ('tv-escritorio@iamroy.app','anjosgroup.dados@anjosbusiness.com')
    AND (u.id=v_task.assignee_id OR (u.id=ANY(v_mentions) AND EXISTS (SELECT 1 FROM public.user_sector_access a WHERE a.user_id=u.id AND a.account_id=v_task.account_id AND a.sector_id='marketing' AND a.is_active=true)))
  ON CONFLICT (source_id,user_id) WHERE source_type='marketing_task_comment' DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_marketing_task_comment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER marketing_task_comment_notify_after_insert AFTER INSERT ON public.marketing_task_comments FOR EACH ROW EXECUTE FUNCTION public.notify_marketing_task_comment();