CREATE FUNCTION public.marketing_task_label_key(value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT lower(normalize(trim(regexp_replace(coalesce(value, ''), '[[:space:]]+', ' ', 'g')), NFC));
$$;
REVOKE ALL ON FUNCTION public.marketing_task_label_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_task_label_key(text) TO authenticated, service_role;

CREATE FUNCTION public.edit_marketing_task_label(p_account_id uuid, p_old_name text, p_name text, p_color text)
RETURNS TABLE(id uuid, tags text[], custom_fields jsonb, updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_old_key text := public.marketing_task_label_key(p_old_name);
  v_name text := trim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g'));
  v_new_key text := public.marketing_task_label_key(p_name);
  v_ids uuid[];
  v_expected integer;
  v_changed integer;
BEGIN
  IF auth.uid() IS NULL OR p_account_id IS DISTINCT FROM public.get_my_account_id() THEN
    RAISE EXCEPTION 'Acesso negado à edição das etiquetas.' USING ERRCODE = '42501';
  END IF;
  IF v_old_key = '' OR v_new_key = '' OR length(v_name) > 60 OR p_color IS NULL OR p_color NOT IN ('blue','green','yellow','red','purple','gray') THEN
    RAISE EXCEPTION 'Informe um nome válido e uma cor da etiqueta.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('marketing-label:' || p_account_id::text, 0));
  IF v_old_key <> v_new_key AND EXISTS (
    SELECT 1 FROM public.marketing_tasks t CROSS JOIN LATERAL unnest(t.tags) tag
    WHERE t.account_id = p_account_id AND public.marketing_task_label_key(tag) = v_new_key
  ) THEN
    RAISE EXCEPTION 'Já existe uma etiqueta com esse nome. Escolha outro nome.' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(locked.id), '{}'::uuid[]) INTO v_ids FROM (
    SELECT t.id FROM public.marketing_tasks t WHERE t.account_id = p_account_id
      AND EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE public.marketing_task_label_key(tag) = v_old_key)
    ORDER BY t.id FOR UPDATE
  ) locked;
  v_expected := cardinality(v_ids);
  IF v_expected = 0 THEN
    RAISE EXCEPTION 'Esta etiqueta não está mais disponível. Atualize a lista.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    UPDATE public.marketing_tasks t SET
      tags = ARRAY(SELECT CASE WHEN public.marketing_task_label_key(tag) = v_old_key THEN v_name ELSE tag END FROM unnest(t.tags) WITH ORDINALITY x(tag, ord) ORDER BY ord),
      custom_fields = coalesce(t.custom_fields, '{}'::jsonb) || jsonb_build_object('delivery_details',
        coalesce(t.custom_fields->'delivery_details', '{}'::jsonb) || jsonb_build_object('label_colors',
          (coalesce(t.custom_fields->'delivery_details'->'label_colors', '{}'::jsonb) - v_old_key) || jsonb_build_object(v_new_key, p_color))),
      updated_at = now()
    WHERE t.account_id = p_account_id AND t.id = ANY(v_ids)
    RETURNING t.id, t.tags, t.custom_fields, t.updated_at;
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  IF v_changed <> v_expected THEN
    RAISE EXCEPTION 'Sem permissão para editar todas as tarefas desta etiqueta.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.edit_marketing_task_label(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_marketing_task_label(uuid,text,text,text) TO authenticated;