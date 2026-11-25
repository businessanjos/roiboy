CREATE FUNCTION public.delete_marketing_task_label(p_account_id uuid, p_name text)
RETURNS TABLE(id uuid, tags text[], custom_fields jsonb, updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_key text := public.marketing_task_label_key(p_name);
  v_ids uuid[];
  v_expected integer;
  v_changed integer;
BEGIN
  IF auth.uid() IS NULL OR p_account_id IS DISTINCT FROM public.get_my_account_id() THEN
    RAISE EXCEPTION 'Acesso negado à exclusão das etiquetas.' USING ERRCODE = '42501';
  END IF;
  IF v_key = '' OR length(v_key) > 60 THEN
    RAISE EXCEPTION 'Informe uma etiqueta válida.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('marketing-label:' || p_account_id::text, 0));
  SELECT count(*) INTO v_expected FROM public.marketing_tasks t WHERE t.account_id = p_account_id
    AND EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE public.marketing_task_label_key(tag) = v_key);
  IF v_expected = 0 THEN
    RETURN;
  END IF;
  SELECT coalesce(array_agg(locked.id), '{}'::uuid[]) INTO v_ids FROM (
    SELECT t.id FROM public.marketing_tasks t WHERE t.account_id = p_account_id
      AND EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE public.marketing_task_label_key(tag) = v_key)
    ORDER BY t.id FOR UPDATE
  ) locked;
  IF cardinality(v_ids) <> v_expected THEN
    RAISE EXCEPTION 'Sem permissão para remover a etiqueta de todas as tarefas.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    UPDATE public.marketing_tasks t SET
      tags = ARRAY(SELECT tag FROM unnest(t.tags) WITH ORDINALITY x(tag, ord)
        WHERE public.marketing_task_label_key(tag) <> v_key ORDER BY ord),
      custom_fields = CASE WHEN jsonb_typeof(t.custom_fields->'delivery_details'->'label_colors') = 'object' THEN
        jsonb_set(t.custom_fields, '{delivery_details,label_colors}',
          (SELECT coalesce(jsonb_object_agg(k, value), '{}'::jsonb)
           FROM jsonb_each(t.custom_fields->'delivery_details'->'label_colors') colors(k, value)
           WHERE public.marketing_task_label_key(k) <> v_key))
        ELSE t.custom_fields END,
      updated_at = now()
    WHERE t.account_id = p_account_id AND t.id = ANY(v_ids)
    RETURNING t.id, t.tags, t.custom_fields, t.updated_at;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed <> v_expected THEN
    RAISE EXCEPTION 'Sem permissão para remover a etiqueta de todas as tarefas.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_marketing_task_label(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_marketing_task_label(uuid,text) TO authenticated;