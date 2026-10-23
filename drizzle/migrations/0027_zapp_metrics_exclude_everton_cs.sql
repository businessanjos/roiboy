DO $mig$
DECLARE d text; n text;
BEGIN
  -- Everton Pieri não conta na produtividade de Customer Success (operacoes)
  d := pg_get_functiondef('public.zapp_productivity_metrics(text,timestamptz,timestamptz,uuid,boolean,uuid)'::regprocedure);
  n := replace(d, $s$    FROM dedup1 d
  ),$s$, $s$    FROM dedup1 d
    WHERE NOT (_sector_id = 'operacoes' AND d.direction = 'outbound'
      AND coalesce(d.sender_user_id, d.sig_uid, d.inf_uid) IS NOT DISTINCT FROM 'de43a643-0109-4afb-ac35-be768dbf4090'::uuid)
  ),$s$);
  IF n = d THEN RAISE EXCEPTION 'metrics pattern not found'; END IF;
  EXECUTE n;

  d := pg_get_functiondef('public.zapp_productivity_agent_conversations'::regproc);
  n := replace(d, $s$    FROM m1
    WHERE (_user_id IS NOT NULL AND m1.uid = _user_id) OR (_user_id IS NULL AND m1.origin = _origin)$s$, $s$    FROM m1
    WHERE NOT (_sector_id = 'operacoes' AND m1.uid IS NOT DISTINCT FROM 'de43a643-0109-4afb-ac35-be768dbf4090'::uuid)
      AND ((_user_id IS NOT NULL AND m1.uid = _user_id) OR (_user_id IS NULL AND m1.origin = _origin))$s$);
  IF n = d THEN RAISE EXCEPTION 'agent conv pattern not found'; END IF;
  EXECUTE n;
END
$mig$;