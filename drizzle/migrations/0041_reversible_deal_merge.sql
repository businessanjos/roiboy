CREATE TABLE public.deal_merge_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL, actor_id uuid NOT NULL,
 source_deal_id uuid NOT NULL, target_deal_id uuid NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
 copied_field_ids uuid[] NOT NULL DEFAULT '{}', note_id uuid, created_at timestamptz NOT NULL DEFAULT now(), undone_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.deal_merge_actions TO authenticated;
GRANT ALL ON public.deal_merge_actions TO service_role;
ALTER TABLE public.deal_merge_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_deal_merge_actions ON public.deal_merge_actions TO authenticated
 USING (account_id = public.get_current_user_account_id() AND actor_id = auth.uid() AND public.can_view_deal_id(source_deal_id) AND public.can_view_deal_id(target_deal_id))
 WITH CHECK (account_id = public.get_current_user_account_id() AND actor_id = auth.uid() AND public.can_view_deal_id(source_deal_id) AND public.can_view_deal_id(target_deal_id));
CREATE FUNCTION public.deal_merge_state(p_source uuid, p_target uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
 SELECT jsonb_build_object(
 'source', (SELECT to_jsonb(d) - 'updated_at' FROM deals d WHERE id=p_source),
 'target', (SELECT to_jsonb(d) - 'updated_at' FROM deals d WHERE id=p_target),
 'activities', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM deal_activities a WHERE deal_id IN(p_source,p_target)), '[]'::jsonb),
 'tasks', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM internal_tasks t WHERE deal_id IN(p_source,p_target)), '[]'::jsonb),
 'fields', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM deal_field_values f WHERE deal_id IN(p_source,p_target)), '[]'::jsonb)
 )
$$;
CREATE FUNCTION public.merge_deals_reversible(p_source uuid, p_target uuid, p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s deals; t deals; b jsonb; a jsonb; copied uuid[]; note uuid; action uuid; affected integer;
BEGIN
 IF auth.uid() IS NULL OR p_source=p_target THEN RAISE EXCEPTION 'Escolha dois negócios diferentes.'; END IF;
 PERFORM id FROM deals WHERE id IN(p_source,p_target) ORDER BY id FOR UPDATE;
 SELECT * INTO s FROM deals WHERE id=p_source AND account_id=get_current_user_account_id() AND deleted_at IS NULL;
 SELECT * INTO t FROM deals WHERE id=p_target AND account_id=get_current_user_account_id() AND deleted_at IS NULL;
 IF s.id IS NULL OR t.id IS NULL THEN RAISE EXCEPTION 'Você não tem acesso aos dois negócios ou um deles não está mais disponível.'; END IF;
 b := deal_merge_state(p_source,p_target);
 UPDATE deals SET title=p_data->>'title', value=(p_data->>'value')::numeric, probability=(p_data->>'probability')::integer,
 expected_close_date=(p_data->>'expected_close_date')::date, source=p_data->>'source',
 responsible_user_id=(p_data->>'responsible_user_id')::uuid, notes=p_data->>'notes', tags=p_data->'tags' WHERE id=p_target;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Não foi possível atualizar o negócio escolhido.'; END IF;
 UPDATE deal_activities SET deal_id=p_target WHERE deal_id=p_source;
 UPDATE internal_tasks SET deal_id=p_target WHERE deal_id=p_source;
 WITH added AS (
 INSERT INTO deal_field_values(account_id,deal_id,field_id,value_text,value_number,value_boolean,value_date,value_json)
 SELECT account_id,p_target,field_id,value_text,value_number,value_boolean,value_date,value_json FROM deal_field_values f
 WHERE deal_id=p_source AND NOT EXISTS(SELECT 1 FROM deal_field_values x WHERE x.deal_id=p_target AND x.field_id=f.field_id)
 RETURNING id) SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO copied FROM added;
 INSERT INTO deal_activities(account_id,deal_id,type,title,content,user_id)
 VALUES(t.account_id,p_target,'note','Negócio mesclado',format('O negócio "%s" foi mesclado a este negócio. Lead mantido: %s.',s.title,coalesce(t.lead_id::text,'sem lead vinculado')),get_current_user_id()) RETURNING id INTO note;
 UPDATE deals SET deleted_at=now(),deleted_by=auth.uid() WHERE id=p_source;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Não foi possível concluir a mesclagem.'; END IF;
 a := deal_merge_state(p_source,p_target);
 INSERT INTO deal_merge_actions(account_id,actor_id,source_deal_id,target_deal_id,before_state,after_state,copied_field_ids,note_id)
 VALUES(t.account_id,auth.uid(),p_source,p_target,b,a,copied,note) RETURNING id INTO action;
 RETURN action;
END $$;
CREATE FUNCTION public.undo_deal_merge(p_action uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE a deal_merge_actions; t deals; item jsonb; affected integer;
BEGIN
 SELECT * INTO a FROM deal_merge_actions WHERE id=p_action AND actor_id=auth.uid() AND account_id=get_current_user_account_id() FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Você não tem acesso a esta mesclagem.'; END IF;
 IF a.undone_at IS NOT NULL THEN RAISE EXCEPTION 'Esta mesclagem já foi desfeita.'; END IF;
 PERFORM id FROM deals WHERE id IN(a.source_deal_id,a.target_deal_id) ORDER BY id FOR UPDATE;
 IF deal_merge_state(a.source_deal_id,a.target_deal_id) IS DISTINCT FROM a.after_state THEN
 RAISE EXCEPTION 'Os negócios receberam alterações após a mesclagem. Não é seguro desfazer automaticamente.'; END IF;
 SELECT * INTO t FROM jsonb_populate_record(NULL::deals,a.before_state->'target');
 UPDATE deals SET title=t.title,value=t.value,probability=t.probability,expected_close_date=t.expected_close_date,
 source=t.source,responsible_user_id=t.responsible_user_id,notes=t.notes,tags=t.tags WHERE id=a.target_deal_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Não foi possível restaurar o negócio.'; END IF;
 UPDATE deals SET deleted_at=NULL,deleted_by=NULL WHERE id=a.source_deal_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Não foi possível restaurar o negócio original.'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(a.before_state->'activities') LOOP
 UPDATE deal_activities SET deal_id=(item->>'deal_id')::uuid WHERE id=(item->>'id')::uuid;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(a.before_state->'tasks') LOOP
 UPDATE internal_tasks SET deal_id=(item->>'deal_id')::uuid WHERE id=(item->>'id')::uuid;
 END LOOP;
 DELETE FROM deal_field_values WHERE id=ANY(a.copied_field_ids) AND deal_id=a.target_deal_id;
 DELETE FROM deal_activities WHERE id=a.note_id AND deal_id=a.target_deal_id;
 UPDATE deal_merge_actions SET undone_at=now() WHERE id=a.id;
 RETURN a.source_deal_id;
END $$;
REVOKE ALL ON FUNCTION public.deal_merge_state(uuid,uuid), public.merge_deals_reversible(uuid,uuid,jsonb), public.undo_deal_merge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_merge_state(uuid,uuid), public.merge_deals_reversible(uuid,uuid,jsonb), public.undo_deal_merge(uuid) TO authenticated;
