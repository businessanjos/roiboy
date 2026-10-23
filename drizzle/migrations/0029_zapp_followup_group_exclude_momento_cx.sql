DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.zapp_is_followup_group(uuid,text)'::regprocedure);
  n := replace(d, $s$(financeiro|$s$, $s$(momento\W*cx|financeiro|$s$);
  IF n = d THEN RAISE EXCEPTION 'pattern not found'; END IF;
  EXECUTE n;
END
$mig$;