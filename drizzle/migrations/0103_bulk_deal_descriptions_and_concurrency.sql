DO $ddl$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.bulk_deal_item_apply()'::regprocedure) INTO definition;
 definition:=replace(definition,'337accfb-58a3-4158-ac66-89a74397ec40','afc29a55-2252-4875-86d7-dc26ffd232a5');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.bulk_deal_operation_prepare()'::regprocedure) INTO definition;
 definition:=replace(definition,'DECLARE u public.users;','DECLARE u public.users;description text;');
 definition:=replace(definition,'NEW.actor_id:=auth.uid();NEW.actor_name:=u.name;',
 'PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 IF NEW.action->>''type''=''move'' THEN
 SELECT p.name || '' → '' || s.name INTO description FROM pipelines p JOIN deal_stages s ON s.pipeline_id=p.id WHERE p.id=(NEW.action->>''pipelineId'')::uuid AND s.id=(NEW.action->>''stageId'')::uuid AND p.account_id=u.account_id;
 ELSIF NEW.action->>''type''=''product'' THEN
 SELECT ''Produto: '' || name INTO description FROM products WHERE id=(NEW.action->>''productId'')::uuid AND account_id=u.account_id;
 ELSIF NEW.action->>''type''=''field'' THEN
 SELECT ''Campo: '' || name INTO description FROM custom_fields WHERE id=(NEW.action->>''fieldId'')::uuid AND account_id=u.account_id;
 ELSE description:=''Valor: R$ '' || coalesce(NEW.action->>''value'',''''); END IF;
 NEW.action:=(NEW.action - ''description'') || jsonb_build_object(''description'',coalesce(description,''Alteração em massa''));
 NEW.actor_id:=auth.uid();NEW.actor_name:=u.name;');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.undo_last_bulk_deal_move(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,0));','PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_operation::text,0));');
 EXECUTE definition;
END $ddl$;