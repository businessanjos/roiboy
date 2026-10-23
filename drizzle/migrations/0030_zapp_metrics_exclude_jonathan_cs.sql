DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.zapp_productivity_metrics(text,timestamptz,timestamptz,uuid,boolean,uuid)'::regprocedure);
  n := replace(d, $s$coalesce(d.sender_user_id, d.sig_uid, d.inf_uid) IS NOT DISTINCT FROM 'de43a643-0109-4afb-ac35-be768dbf4090'::uuid$s$,
    $s$coalesce(d.sender_user_id, d.sig_uid, d.inf_uid) IN ('de43a643-0109-4afb-ac35-be768dbf4090'::uuid, '1232ec15-5f66-4b5f-9e74-f40d436f9d0f'::uuid)$s$);
  IF n = d THEN RAISE EXCEPTION 'metrics pattern not found'; END IF;
  EXECUTE n;

  d := pg_get_functiondef('public.zapp_productivity_agent_conversations'::regproc);
  n := replace(d, $s$m1.uid IS NOT DISTINCT FROM 'de43a643-0109-4afb-ac35-be768dbf4090'::uuid$s$,
    $s$m1.uid IN ('de43a643-0109-4afb-ac35-be768dbf4090'::uuid, '1232ec15-5f66-4b5f-9e74-f40d436f9d0f'::uuid)$s$);
  IF n = d THEN RAISE EXCEPTION 'agent conv pattern not found'; END IF;
  EXECUTE n;
END
$mig$;