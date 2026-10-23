CREATE OR REPLACE FUNCTION public.zapp_is_followup_group(_conv uuid, _name text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  -- Grupos da empresa (Anjos, Eternum interno, bugs, financeiro, Everton etc.) nunca contam.
  SELECT coalesce(_name,'') !~* '(financeiro|bugs?\W*roy|\mbugs?\M|tech supor|cancelamento|congelamento|everton\W*pieri|canal\W*anjo|anjos?\W*consultor|\manjos|anjo\W*group|eternum\W*canal|canal\W*eternum|^\W*e[cm]\W*\|\W*eternum|eternum\W*experience|retirar\W*acessos|executivos\W*comerciais|white\W*label)'
     AND NOT EXISTS (SELECT 1 FROM public.zapp_metrics_excluded_conversations x WHERE x.conversation_id = _conv)
     AND (SELECT count(*) FROM public.zapp_group_clients g WHERE g.conversation_id = _conv) BETWEEN 1 AND 19;
$function$;