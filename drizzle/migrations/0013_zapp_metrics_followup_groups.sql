CREATE OR REPLACE FUNCTION public.zapp_is_followup_group(_conv uuid, _name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(_name,'') !~* '(financeiro|bugs?\s*roy|tech supor|cancelamento|congelamento)'
     AND (SELECT count(*) FROM public.zapp_group_clients g WHERE g.conversation_id = _conv) BETWEEN 1 AND 19;
$$;
REVOKE ALL ON FUNCTION public.zapp_is_followup_group(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zapp_is_followup_group(uuid, text) TO authenticated, service_role;

DO $do$
DECLARE r record; d text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname IN ('zapp_productivity_metrics','zapp_productivity_contacts') LOOP
    d := pg_get_functiondef(r.oid);
    IF position('zapp_is_followup_group' in d) > 0 THEN CONTINUE; END IF;
    d := replace(d, 'AND (_include_groups OR coalesce(c.is_group, false) = false)',
                    'AND (_include_groups OR coalesce(c.is_group, false) = false OR public.zapp_is_followup_group(c.id, c.contact_name))');
    d := replace(d, E'      AND NOT _include_groups\n',
                    E'      AND NOT _include_groups\n      AND NOT public.zapp_is_followup_group(c.id, c.contact_name)\n');
    EXECUTE d;
  END LOOP;
END $do$;