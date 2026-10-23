CREATE OR REPLACE FUNCTION public.zapp_is_followup_group(_conv uuid, _name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Grupos internos (bugs, financeiro, canal/consultor Anjos, Everton Pieri etc.) nunca contam.
  SELECT coalesce(_name,'') !~* '(financeiro|bugs?\W*roy|\mbugs?\M|tech supor|cancelamento|congelamento|everton\W*pieri|canal\W*anjo|anjos?\W*consultor|\manjos\M|eternum\W*canal|canal\W*\W*eternum)'
     AND (SELECT count(*) FROM public.zapp_group_clients g WHERE g.conversation_id = _conv) BETWEEN 1 AND 19;
$function$;