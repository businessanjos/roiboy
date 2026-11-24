CREATE OR REPLACE FUNCTION public.begin_bulk_deal_operation(p_action jsonb,p_deal_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE op uuid;
BEGIN
 INSERT INTO bulk_deal_operations(account_id,actor_id,actor_name,action,deal_ids)
 VALUES(get_current_user_account_id(),auth.uid(),'',p_action,p_deal_ids) RETURNING id INTO op;
 RETURN op;
END $$;

CREATE OR REPLACE FUNCTION public.get_last_bulk_deal_move()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT can_bulk_edit_deals() OR NOT user_has_sector_access(auth.uid(),'vendas') THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
 SELECT jsonb_build_object('id',o.id,'changed_count',(SELECT count(*) FROM bulk_deal_operation_items i WHERE i.operation_id=o.id AND i.success AND i.changed),'status',o.status,'undone_at',o.undone_at)
 INTO result FROM bulk_deal_operations o WHERE o.account_id=get_current_user_account_id() AND o.actor_id=auth.uid() AND o.action->>'type'='move'
 AND EXISTS(SELECT 1 FROM bulk_deal_operation_items i WHERE i.operation_id=o.id AND i.success AND i.changed)
 ORDER BY o.created_at DESC,o.id DESC LIMIT 1;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_last_bulk_deal_move() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_last_bulk_deal_move() TO authenticated;

DO $ddl$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.bulk_deal_item_apply()'::regprocedure) INTO definition;
 definition:=replace(definition,'field_id uuid;old_stage','target_field uuid;old_stage');
 definition:=replace(definition,'field_id:=CASE','target_field:=CASE');
 definition:=replace(definition,'WHERE id=field_id AND','WHERE id=target_field AND');
 definition:=replace(definition,'AND field_id IN(field_id,','AND v.field_id IN(target_field,');
 definition:=replace(definition,'ELSE cols:=o.action->''columns''; END IF;',
 'ELSE
 IF f.id IN (''033b91fb-3add-4c96-aec9-567fefbd0fb2''::uuid,''337accfb-58a3-4158-ac66-89a74397ec40''::uuid) THEN RAISE EXCEPTION ''Use a alteração específica deste campo.''; END IF;
 cols:=CASE WHEN f.field_type IN (''number'',''currency'') THEN jsonb_build_object(''value_number'',o.action->''columns''->''value_number'')
 WHEN f.field_type=''boolean'' THEN jsonb_build_object(''value_boolean'',o.action->''columns''->''value_boolean'')
 WHEN f.field_type=''date'' THEN jsonb_build_object(''value_date'',o.action->''columns''->''value_date'')
 WHEN f.field_type IN (''multi_select'',''user'',''location'',''multi_instagram'') THEN jsonb_build_object(''value_json'',o.action->''columns''->''value_json'')
 ELSE jsonb_build_object(''value_text'',o.action->''columns''->''value_text'') END;
 END IF;');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.undo_last_bulk_deal_move(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'last_op uuid;n integer','last_op uuid;last_info jsonb;n integer');
 definition:=replace(definition,'SELECT b.id INTO last_op FROM bulk_deal_operations b WHERE b.account_id=o.account_id AND b.actor_id=auth.uid() AND b.action->>''type''=''move''
 AND EXISTS(SELECT 1 FROM bulk_deal_operation_items x WHERE x.operation_id=b.id AND x.success AND x.changed) ORDER BY b.created_at DESC,b.id DESC LIMIT 1;',
 'last_info:=get_last_bulk_deal_move();last_op:=(last_info->>''id'')::uuid;');
 definition:=replace(definition,'n<>(SELECT count(*) FROM bulk_deal_operation_items x WHERE x.operation_id=o.id AND x.success AND x.changed)','n<>(last_info->>''changed_count'')::integer');
 EXECUTE definition;
END $ddl$;