DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.zapp_productivity_metrics(text,timestamptz,timestamptz,uuid,boolean,uuid)'::regprocedure);
  n := replace(d, $s$'1232ec15-5f66-4b5f-9e74-f40d436f9d0f'::uuid)$s$, $s$'1232ec15-5f66-4b5f-9e74-f40d436f9d0f'::uuid, 'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid)$s$);
  IF n = d THEN RAISE EXCEPTION 'metrics pattern not found'; END IF;
  EXECUTE n;

  d := pg_get_functiondef('public.zapp_productivity_agent_conversations'::regproc);
  n := replace(d, $s$'1232ec15-5f66-4b5f-9e74-f40d436f9d0f'::uuid)$s$, $s$'1232ec15-5f66-4b5f-9e74-f40d436f9d0f'::uuid, 'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid)$s$);
  IF n = d THEN RAISE EXCEPTION 'agent conv pattern not found'; END IF;
  EXECUTE n;
END
$mig$;