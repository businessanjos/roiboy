DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.zapp_productivity_agent_conversations'::regproc);
  n := replace(d, $s$'contact_name', c.contact_name$s$, $s$'contact_name', coalesce(
          (SELECT nullif(btrim(cl.full_name), '') FROM public.clients cl WHERE cl.id = c.client_id),
          (SELECT nullif(btrim(ld.full_name), '') FROM public.zapp_conversations zc JOIN public.leads ld ON ld.id = zc.lead_id WHERE zc.id = c.id),
          CASE WHEN c.contact_name IS NOT NULL AND c.contact_name <> 'Desconhecido' THEN c.contact_name END,
          c.phone_e164, 'Desconhecido')$s$);
  IF n = d THEN RAISE EXCEPTION 'name pattern not found'; END IF;
  EXECUTE n;
END
$mig$;