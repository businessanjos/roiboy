DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.zapp_productivity_metrics(text,timestamptz,timestamptz,uuid,boolean,uuid)'::regprocedure);
  n := replace(d, $s$'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid)$s$, $s$'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid)
      AND coalesce(d.sender_user_id, d.sig_uid, d.inf_uid) IS DISTINCT FROM _agent_user_id$s$);
  IF n = d THEN RAISE EXCEPTION 'metrics pattern not found'; END IF;
  EXECUTE n;

  d := pg_get_functiondef('public.zapp_productivity_agent_conversations'::regproc);
  n := replace(d, $s$'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid)$s$, $s$'c064c5d5-cdb5-47cc-99ce-ad416b6407b1'::uuid)
      AND m1.uid IS DISTINCT FROM _user_id$s$);
  IF n = d THEN RAISE EXCEPTION 'agent conv pattern not found'; END IF;
  EXECUTE n;
END
$mig$;