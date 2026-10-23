DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.zapp_infer_sender(uuid,timestamptz)'::regprocedure);
  n := replace(d, $s$      HAVING count(DISTINCT cl.responsible_user_id) = 1),$s$, $s$      HAVING count(DISTINCT cl.responsible_user_id) = 1),
    (SELECT min(cl.responsible_user_id::text)::uuid FROM public.zapp_conversations c
      JOIN public.clients cl ON cl.account_id = c.account_id
       AND public.zapp_phone_core(cl.phone_e164) = public.zapp_phone_core(c.phone_e164)
      WHERE c.id = _cid AND c.group_jid IS NULL AND c.client_id IS NULL
        AND public.zapp_phone_core(c.phone_e164) IS NOT NULL AND public.zapp_phone_core(c.phone_e164) <> ''
        AND cl.responsible_user_id IS NOT NULL
        AND cl.responsible_user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
      HAVING count(DISTINCT cl.responsible_user_id) = 1),$s$);
  IF n = d THEN RAISE EXCEPTION 'infer pattern not found'; END IF;
  EXECUTE n;
END
$mig$;