CREATE OR REPLACE FUNCTION public.can_bulk_edit_deals()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.users u WHERE u.auth_user_id=auth.uid()
 AND (u.role::text IN ('admin','super_admin','gestor','head','leader') OR coalesce(u.is_also_admin,false)));
$$;
REVOKE ALL ON FUNCTION public.can_bulk_edit_deals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_bulk_edit_deals() TO authenticated,service_role;

CREATE TABLE public.bulk_deal_operations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL,
 actor_id uuid NOT NULL, actor_name text NOT NULL, action jsonb NOT NULL,
 deal_ids uuid[] NOT NULL, status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','interrupted')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz, undone_at timestamptz,
 undone_by uuid, UNIQUE(id,account_id)
);
GRANT SELECT,INSERT ON public.bulk_deal_operations TO authenticated;
GRANT ALL ON public.bulk_deal_operations TO service_role;
ALTER TABLE public.bulk_deal_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY bulk_operations_read ON public.bulk_deal_operations FOR SELECT TO authenticated
 USING(account_id=get_current_user_account_id() AND can_bulk_edit_deals() AND user_has_sector_access(auth.uid(),'vendas'));
CREATE POLICY bulk_operations_create ON public.bulk_deal_operations FOR INSERT TO authenticated
 WITH CHECK(account_id=get_current_user_account_id() AND actor_id=auth.uid() AND can_bulk_edit_deals() AND user_has_sector_access(auth.uid(),'vendas'));
CREATE INDEX bulk_operations_account_created ON public.bulk_deal_operations(account_id,created_at DESC,id);

CREATE TABLE public.bulk_deal_operation_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id uuid NOT NULL,account_id uuid NOT NULL,
 deal_id uuid NOT NULL,title text NOT NULL DEFAULT '',success boolean NOT NULL DEFAULT false,
 changed boolean NOT NULL DEFAULT false,error text,before_state jsonb,after_state jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),undone_at timestamptz,
 UNIQUE(operation_id,deal_id), FOREIGN KEY(operation_id,account_id) REFERENCES public.bulk_deal_operations(id,account_id)
);
GRANT SELECT,INSERT ON public.bulk_deal_operation_items TO authenticated;
GRANT ALL ON public.bulk_deal_operation_items TO service_role;
ALTER TABLE public.bulk_deal_operation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY bulk_items_read ON public.bulk_deal_operation_items FOR SELECT TO authenticated
 USING(account_id=get_current_user_account_id() AND can_bulk_edit_deals() AND user_has_sector_access(auth.uid(),'vendas') AND can_view_deal_id(deal_id));
CREATE POLICY bulk_items_create ON public.bulk_deal_operation_items FOR INSERT TO authenticated
 WITH CHECK(account_id=get_current_user_account_id() AND can_bulk_edit_deals() AND user_has_sector_access(auth.uid(),'vendas')
 AND EXISTS(SELECT 1 FROM public.bulk_deal_operations o WHERE o.id=operation_id AND o.actor_id=auth.uid() AND o.status='running'));

CREATE OR REPLACE FUNCTION public.bulk_deal_operation_prepare()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE u public.users;
BEGIN
 IF NOT can_bulk_edit_deals() OR NOT user_has_sector_access(auth.uid(),'vendas') THEN RAISE EXCEPTION 'Somente administradores e gestores podem alterar em massa.'; END IF;
 SELECT * INTO u FROM public.users WHERE auth_user_id=auth.uid() LIMIT 1;
 IF u.id IS NULL THEN RAISE EXCEPTION 'Sessão não disponível.'; END IF;
 IF coalesce(cardinality(NEW.deal_ids),0)=0 OR cardinality(NEW.deal_ids)>5000 THEN RAISE EXCEPTION 'Selecione de 1 a 5.000 negócios.'; END IF;
 IF NEW.action->>'type' NOT IN ('move','product','value','field') OR NEW.action->>'type' IS NULL THEN RAISE EXCEPTION 'Alteração inválida.'; END IF;
 IF NEW.action ? 'actor_id' OR NEW.action ? 'owner_id' OR NEW.actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Autoria deve corresponder à sessão.'; END IF;
 IF NEW.account_id IS DISTINCT FROM u.account_id THEN RAISE EXCEPTION 'Conta inválida.'; END IF;
 NEW.actor_id:=auth.uid();NEW.actor_name:=u.name;NEW.status:='running';NEW.created_at:=clock_timestamp();NEW.finished_at:=NULL;NEW.undone_at:=NULL;NEW.undone_by:=NULL;
 SELECT array_agg(DISTINCT x) INTO NEW.deal_ids FROM unnest(NEW.deal_ids) x;
 RETURN NEW;
END $$;
CREATE TRIGGER bulk_operation_prepare BEFORE INSERT ON public.bulk_deal_operations FOR EACH ROW EXECUTE FUNCTION public.bulk_deal_operation_prepare();

CREATE OR REPLACE FUNCTION public.bulk_deal_validate_stage(p_deal uuid,p_stage uuid,p_account uuid)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE missing text;
BEGIN
 SELECT string_agg(f.name,', ' ORDER BY f.display_order) INTO missing
 FROM custom_fields f WHERE f.account_id=p_account AND f.is_active AND f.show_in_deals AND f.is_required
 AND (f.required_stages IS NULL OR jsonb_array_length(to_jsonb(f.required_stages))=0 OR to_jsonb(f.required_stages) ? 'all' OR to_jsonb(f.required_stages) ? p_stage::text)
 AND NOT EXISTS(SELECT 1 FROM deal_field_values v WHERE v.deal_id=p_deal AND v.field_id=f.id
 AND (coalesce(v.value_text,'')<>'' OR v.value_number IS NOT NULL OR v.value_boolean IS NOT NULL OR v.value_date IS NOT NULL
 OR (v.value_json IS NOT NULL AND v.value_json NOT IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb,'""'::jsonb))))
 AND NOT(f.id='521b553f-071d-418d-ae1c-1382356d7d9a' AND EXISTS(SELECT 1 FROM deals d WHERE d.id=p_deal AND btrim(coalesce(d.contact_phone,''))<>''));
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Preencha antes: %.',missing; END IF;
END $$;
REVOKE ALL ON FUNCTION public.bulk_deal_validate_stage(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bulk_deal_validate_stage(uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_deal_item_apply()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE o public.bulk_deal_operations;d public.deals;s public.deal_stages;f public.custom_fields;
 target_pipeline uuid;target_stage uuid;field_id uuid;old_stage text;source_pipeline text;cols jsonb;
 before_fields jsonb;after_fields jsonb;label text;mql text;affected integer;
BEGIN
 IF NOT can_bulk_edit_deals() OR NOT user_has_sector_access(auth.uid(),'vendas') THEN RAISE EXCEPTION 'Somente administradores e gestores podem alterar em massa.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.operation_id::text,0));
 SELECT * INTO o FROM bulk_deal_operations WHERE id=NEW.operation_id AND actor_id=auth.uid() AND account_id=get_current_user_account_id() AND status='running';
 IF o.id IS NULL OR NOT(NEW.deal_id=ANY(o.deal_ids)) THEN RAISE EXCEPTION 'Operação indisponível ou negócio fora da seleção.'; END IF;
 NEW.account_id:=o.account_id;NEW.success:=false;NEW.changed:=false;NEW.error:=NULL;NEW.before_state:=NULL;NEW.after_state:=NULL;NEW.undone_at:=NULL;NEW.created_at:=clock_timestamp();NEW.title:='Negócio indisponível';
 BEGIN
  SELECT * INTO d FROM deals WHERE id=NEW.deal_id AND account_id=o.account_id AND deleted_at IS NULL FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Sem acesso para alterar este negócio.'; END IF;
  NEW.title:=d.title;
  NEW.before_state:=jsonb_build_object('deal',to_jsonb(d));
  IF o.action->>'type'='move' THEN
   IF d.status<>'open' THEN RAISE EXCEPTION 'Negócio encerrado. Reabra individualmente antes de mudar o funil ou a etapa.'; END IF;
   target_pipeline:=(o.action->>'pipelineId')::uuid;target_stage:=(o.action->>'stageId')::uuid;
   SELECT * INTO s FROM deal_stages WHERE id=target_stage AND pipeline_id=target_pipeline AND account_id=o.account_id AND is_active;
   IF s.id IS NULL OR NOT EXISTS(SELECT 1 FROM pipelines WHERE id=target_pipeline AND account_id=o.account_id AND is_active AND lower(name) NOT LIKE '%repescagem%') THEN RAISE EXCEPTION 'Etapa ou funil de destino indisponível.'; END IF;
   PERFORM bulk_deal_validate_stage(d.id,s.id,o.account_id);
   SELECT name INTO source_pipeline FROM pipelines WHERE id=d.pipeline_id;
   SELECT name INTO old_stage FROM deal_stages WHERE id=d.stage_id;
   IF s.name='Reunião Agendada' AND source_pipeline='SDR' THEN
    SELECT ds.* INTO s FROM deal_stages ds JOIN pipelines p ON p.id=ds.pipeline_id WHERE p.account_id=o.account_id AND p.name='Closer' AND p.is_active AND ds.name='Reunião Agendada' AND ds.is_active LIMIT 1;
    IF s.id IS NULL THEN RAISE EXCEPTION 'Etapa Reunião Agendada no Closer indisponível.'; END IF;
    target_pipeline:=s.pipeline_id;target_stage:=s.id;
    PERFORM bulk_deal_validate_stage(d.id,s.id,o.account_id);
   END IF;
   IF d.pipeline_id IS DISTINCT FROM target_pipeline OR d.stage_id IS DISTINCT FROM target_stage THEN
    UPDATE deals SET pipeline_id=target_pipeline,stage_id=target_stage,probability=coalesce(s.probability,0) WHERE id=d.id AND account_id=o.account_id AND deleted_at IS NULL;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN RAISE EXCEPTION 'Sem acesso para mover este negócio.'; END IF;
    INSERT INTO deal_activities(account_id,deal_id,type,title,old_value,new_value,user_id)
    VALUES(o.account_id,d.id,'stage_change','Movimentação em massa',coalesce(old_stage,'Sem etapa'),s.name,get_current_user_id());
    NEW.changed:=true;
   END IF;
  ELSIF o.action->>'type'='value' THEN
   IF (o.action->>'value')::numeric<0 OR o.action->>'value' IS NULL OR lower(o.action->>'value') IN ('nan','infinity','-infinity') THEN RAISE EXCEPTION 'Informe um valor válido, maior ou igual a zero.'; END IF;
   IF d.value IS DISTINCT FROM (o.action->>'value')::numeric THEN
    UPDATE deals SET value=(o.action->>'value')::numeric WHERE id=d.id AND account_id=o.account_id AND deleted_at IS NULL;
    GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Sem acesso para alterar este negócio.'; END IF;
    NEW.changed:=true;
   END IF;
  ELSE
   field_id:=CASE WHEN o.action->>'type'='product' THEN '033b91fb-3add-4c96-aec9-567fefbd0fb2'::uuid ELSE (o.action->>'fieldId')::uuid END;
   SELECT * INTO f FROM custom_fields WHERE id=field_id AND account_id=o.account_id AND is_active AND show_in_deals;
   IF f.id IS NULL THEN RAISE EXCEPTION 'Campo indisponível.'; END IF;
   IF o.action->>'type'='field' AND f.field_type IS DISTINCT FROM o.action->>'fieldType' THEN RAISE EXCEPTION 'O tipo deste campo mudou. Reabra a seleção.'; END IF;
   IF o.action->>'type'='product' THEN
    IF NOT EXISTS(SELECT 1 FROM products WHERE id=(o.action->>'productId')::uuid AND account_id=o.account_id AND is_active) THEN RAISE EXCEPTION 'Produto indisponível.'; END IF;
    cols:=jsonb_build_object('value_text',o.action->>'productId');
   ELSE cols:=o.action->'columns'; END IF;
   SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.field_id),'[]'::jsonb) INTO before_fields FROM deal_field_values v WHERE deal_id=d.id AND field_id IN(field_id,'448404cd-0344-4892-a574-2387b1c17578'::uuid);
   NEW.before_state:=NEW.before_state || jsonb_build_object('fields',before_fields);
   INSERT INTO deal_field_values(account_id,deal_id,field_id,value_text,value_number,value_boolean,value_date,value_json)
   VALUES(o.account_id,d.id,f.id,cols->>'value_text',(cols->>'value_number')::numeric,(cols->>'value_boolean')::boolean,(cols->>'value_date')::date,NULLIF(cols->'value_json','null'::jsonb))
   ON CONFLICT(deal_id,field_id) DO UPDATE SET value_text=excluded.value_text,value_number=excluded.value_number,value_boolean=excluded.value_boolean,value_date=excluded.value_date,value_json=excluded.value_json;
   IF f.id='ed5c7c0e-0740-4945-b982-70a593ffae0c' AND coalesce(cols->>'value_text','')<>'' THEN
    SELECT coalesce(opt->>'label',cols->>'value_text') INTO label FROM jsonb_array_elements(coalesce(f.options,'[]'::jsonb)) opt WHERE opt->>'value'=cols->>'value_text' LIMIT 1;
    label:=lower(coalesce(label,cols->>'value_text'));
    mql:=CASE WHEN (label ~ 'abaixo\s+de\s+([0-9]+)' AND (regexp_match(label,'abaixo\s+de\s+([0-9]+)'))[1]::numeric<=30) OR (label ~ 'entre\s+([0-9]+)\s+e\s+([0-9]+)' AND (regexp_match(label,'entre\s+([0-9]+)\s+e\s+([0-9]+)'))[2]::numeric<=30) THEN 'nao_abaixo_30k' ELSE 'sim_acima_30k' END;
    INSERT INTO deal_field_values(account_id,deal_id,field_id,value_text) VALUES(o.account_id,d.id,'448404cd-0344-4892-a574-2387b1c17578',mql)
    ON CONFLICT(deal_id,field_id) DO UPDATE SET value_text=excluded.value_text,value_number=NULL,value_boolean=NULL,value_date=NULL,value_json=NULL;
   END IF;
   SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.field_id),'[]'::jsonb) INTO after_fields FROM deal_field_values v WHERE deal_id=d.id AND v.field_id IN(f.id,'448404cd-0344-4892-a574-2387b1c17578'::uuid);
   NEW.changed:=true;
  END IF;
  SELECT to_jsonb(x) INTO NEW.after_state FROM deals x WHERE x.id=d.id;
  NEW.after_state:=jsonb_build_object('deal',NEW.after_state,'fields',after_fields);
  NEW.success:=true;
 EXCEPTION WHEN OTHERS THEN
  NEW.success:=false;NEW.changed:=false;NEW.before_state:=NULL;NEW.after_state:=NULL;NEW.error:=SQLERRM;
 END;
 RETURN NEW;
END $$;
CREATE TRIGGER bulk_item_apply BEFORE INSERT ON public.bulk_deal_operation_items FOR EACH ROW EXECUTE FUNCTION public.bulk_deal_item_apply();

CREATE OR REPLACE FUNCTION public.begin_bulk_deal_operation(p_action jsonb,p_deal_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE op uuid;
BEGIN
 INSERT INTO bulk_deal_operations(account_id,actor_id,actor_name,action,deal_ids)
 VALUES(get_current_user_account_id(),auth.uid(),'',''::text::jsonb || p_action,p_deal_ids) RETURNING id INTO op;
 RETURN op;
END $$;
CREATE OR REPLACE FUNCTION public.apply_bulk_deal_operation_item(p_operation uuid,p_deal uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r bulk_deal_operation_items;
BEGIN
 SELECT * INTO r FROM bulk_deal_operation_items WHERE operation_id=p_operation AND deal_id=p_deal;
 IF r.id IS NOT NULL THEN RETURN jsonb_build_object('id',r.deal_id,'title',r.title,'success',r.success,'error',r.error,'changed',r.changed); END IF;
 INSERT INTO bulk_deal_operation_items(operation_id,account_id,deal_id) VALUES(p_operation,get_current_user_account_id(),p_deal) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.deal_id,'title',r.title,'success',r.success,'error',r.error,'changed',r.changed);
END $$;
CREATE OR REPLACE FUNCTION public.finish_bulk_deal_operation(p_operation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o bulk_deal_operations;n integer;
BEGIN
 IF NOT can_bulk_edit_deals() OR NOT user_has_sector_access(auth.uid(),'vendas') THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 SELECT * INTO o FROM bulk_deal_operations WHERE id=p_operation AND account_id=get_current_user_account_id() AND actor_id=auth.uid();
 IF o.id IS NULL THEN RAISE EXCEPTION 'Operação indisponível.'; END IF;
 SELECT count(*) INTO n FROM bulk_deal_operation_items WHERE operation_id=o.id;
 UPDATE bulk_deal_operations SET status=CASE WHEN n=cardinality(o.deal_ids) THEN 'completed' ELSE 'interrupted' END,finished_at=clock_timestamp() WHERE id=o.id AND status='running';
END $$;

CREATE OR REPLACE FUNCTION public.bulk_deal_capture_undo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE op uuid;i bulk_deal_operation_items;o bulk_deal_operations;
BEGIN
 op:=NULLIF(current_setting('app.bulk_undo_operation',true),'')::uuid;
 IF op IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO o FROM bulk_deal_operations WHERE id=op AND account_id=get_current_user_account_id() AND actor_id=auth.uid() AND undone_at IS NULL AND status<>'running' AND action->>'type'='move';
 IF o.id IS NULL OR NOT can_bulk_edit_deals() THEN RAISE EXCEPTION 'Reversão não autorizada.'; END IF;
 SELECT * INTO i FROM bulk_deal_operation_items WHERE operation_id=op AND deal_id=NEW.id AND success AND changed AND undone_at IS NULL;
 IF i.id IS NULL THEN RAISE EXCEPTION 'Movimentação não disponível para desfazer.'; END IF;
 IF OLD.pipeline_id IS DISTINCT FROM (i.after_state->'deal'->>'pipeline_id')::uuid OR OLD.stage_id IS DISTINCT FROM (i.after_state->'deal'->>'stage_id')::uuid OR OLD.stage_changed_at IS DISTINCT FROM (i.after_state->'deal'->>'stage_changed_at')::timestamptz
 OR NEW.pipeline_id IS DISTINCT FROM (i.before_state->'deal'->>'pipeline_id')::uuid OR NEW.stage_id IS DISTINCT FROM (i.before_state->'deal'->>'stage_id')::uuid THEN RAISE EXCEPTION 'O negócio recebeu outra movimentação. Nada foi desfeito.'; END IF;
 UPDATE bulk_deal_operation_items SET undone_at=clock_timestamp() WHERE id=i.id;
 IF NOT EXISTS(SELECT 1 FROM bulk_deal_operation_items WHERE operation_id=op AND changed AND success AND undone_at IS NULL) THEN
  UPDATE bulk_deal_operations SET undone_at=clock_timestamp(),undone_by=auth.uid() WHERE id=op;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bulk_capture_undo AFTER UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.bulk_deal_capture_undo();

CREATE OR REPLACE FUNCTION public.undo_last_bulk_deal_move(p_operation uuid)
RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE o bulk_deal_operations;i bulk_deal_operation_items;d deals;last_op uuid;n integer:=0;affected integer;
BEGIN
 IF NOT can_bulk_edit_deals() OR NOT user_has_sector_access(auth.uid(),'vendas') THEN RAISE EXCEPTION 'Somente administradores e gestores podem desfazer.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,0));
 SELECT * INTO o FROM bulk_deal_operations WHERE id=p_operation AND account_id=get_current_user_account_id() AND actor_id=auth.uid();
 IF o.id IS NULL OR o.action->>'type'<>'move' OR o.status='running' OR o.undone_at IS NOT NULL THEN RAISE EXCEPTION 'Movimentação indisponível ou já desfeita.'; END IF;
 SELECT b.id INTO last_op FROM bulk_deal_operations b WHERE b.account_id=o.account_id AND b.actor_id=auth.uid() AND b.action->>'type'='move'
 AND EXISTS(SELECT 1 FROM bulk_deal_operation_items x WHERE x.operation_id=b.id AND x.success AND x.changed) ORDER BY b.created_at DESC,b.id DESC LIMIT 1;
 IF last_op IS DISTINCT FROM o.id THEN RAISE EXCEPTION 'Só é possível desfazer a última movimentação própria.'; END IF;
 FOR i IN SELECT * FROM bulk_deal_operation_items WHERE operation_id=o.id AND success AND changed ORDER BY deal_id LOOP
  SELECT * INTO d FROM deals WHERE id=i.deal_id AND account_id=o.account_id AND deleted_at IS NULL FOR UPDATE;
  IF d.id IS NULL OR d.status<>'open' OR d.pipeline_id IS DISTINCT FROM (i.after_state->'deal'->>'pipeline_id')::uuid OR d.stage_id IS DISTINCT FROM (i.after_state->'deal'->>'stage_id')::uuid
  OR d.stage_changed_at IS DISTINCT FROM (i.after_state->'deal'->>'stage_changed_at')::timestamptz OR d.probability IS DISTINCT FROM (i.after_state->'deal'->>'probability')::integer THEN RAISE EXCEPTION 'Um negócio recebeu alterações após a movimentação ou perdeu o acesso. Nada foi desfeito.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM deal_stages s JOIN pipelines p ON p.id=s.pipeline_id WHERE s.id=(i.before_state->'deal'->>'stage_id')::uuid AND s.pipeline_id=(i.before_state->'deal'->>'pipeline_id')::uuid AND s.account_id=o.account_id AND s.is_active AND p.is_active) THEN RAISE EXCEPTION 'Etapa original indisponível. Nada foi desfeito.'; END IF;
  PERFORM bulk_deal_validate_stage(d.id,(i.before_state->'deal'->>'stage_id')::uuid,o.account_id);
  n:=n+1;
 END LOOP;
 IF n=0 THEN RAISE EXCEPTION 'Nenhum negócio movido para desfazer.'; END IF;
 IF n<>(SELECT count(*) FROM bulk_deal_operation_items x WHERE x.operation_id=o.id AND x.success AND x.changed) THEN RAISE EXCEPTION 'Sem acesso a todos os negócios. Nada foi desfeito.'; END IF;
 PERFORM set_config('app.bulk_undo_operation',o.id::text,true);
 FOR i IN SELECT * FROM bulk_deal_operation_items WHERE operation_id=o.id AND success AND changed ORDER BY deal_id LOOP
  UPDATE deals SET pipeline_id=(i.before_state->'deal'->>'pipeline_id')::uuid,stage_id=(i.before_state->'deal'->>'stage_id')::uuid,probability=(i.before_state->'deal'->>'probability')::integer WHERE id=i.deal_id AND account_id=o.account_id AND deleted_at IS NULL;
  GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Sem acesso para reverter. Nada foi desfeito.'; END IF;
  INSERT INTO deal_activities(account_id,deal_id,type,title,user_id) VALUES(o.account_id,i.deal_id,'stage_change','Movimentação em massa desfeita',get_current_user_id());
 END LOOP;
 PERFORM set_config('app.bulk_undo_operation','',true);
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.begin_bulk_deal_operation(jsonb,uuid[]),public.apply_bulk_deal_operation_item(uuid,uuid),public.finish_bulk_deal_operation(uuid),public.undo_last_bulk_deal_move(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_bulk_deal_operation(jsonb,uuid[]),public.apply_bulk_deal_operation_item(uuid,uuid),public.finish_bulk_deal_operation(uuid),public.undo_last_bulk_deal_move(uuid) TO authenticated;
