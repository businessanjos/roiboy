DO $mig$
DECLARE d text; n text;
BEGIN
  -- Métricas: todo envio sem atendente (celular, automação, canal, histórico, assinatura desconhecida) herda o dono da conversa
  d := pg_get_functiondef('public.zapp_productivity_metrics(text,timestamptz,timestamptz,uuid,boolean,uuid)'::regprocedure);
  n := replace(d, $s$d.sender_user_id IS NULL AND su.id IS NULL AND NOT d.from_history AND coalesce(d.sender_name,'') NOT ILIKE 'canal%' AND coalesce(d.sender_name,'') NOT ILIKE '%automa%' AND d.sig IS NULL AND$s$, $s$d.sender_user_id IS NULL AND su.id IS NULL AND$s$);
  IF n = d THEN RAISE EXCEPTION 'metrics pattern not found'; END IF;
  EXECUTE n;

  -- Lista de conversas por atendente: mesma regra + contatos internos calculados uma vez
  d := pg_get_functiondef('public.zapp_productivity_agent_conversations'::regproc);
  n := replace(d, $s$m0.sender_user_id IS NULL AND su.id IS NULL AND NOT m0.from_history AND coalesce(m0.sender_name,'') NOT ILIKE 'canal%' AND coalesce(m0.sender_name,'') NOT ILIKE '%automa%' AND m0.sig IS NULL AND$s$, $s$m0.sender_user_id IS NULL AND su.id IS NULL AND$s$);
  IF n = d THEN RAISE EXCEPTION 'agent conv pattern not found'; END IF;
  d := n;
  n := replace(d, $s$      AND NOT public.zapp_should_exclude_contact(_account, c.phone_e164, c.client_id)$s$,
$s$      AND NOT (
        coalesce(public.zapp_phone_core(c.phone_e164) IN (SELECT ic.pcore FROM internal_cores ic WHERE ic.pcore IS NOT NULL), false)
        AND NOT EXISTS (SELECT 1 FROM public.client_contracts cc WHERE cc.client_id = c.client_id AND cc.status = 'active')
      )$s$);
  n := replace(n, $s$  WITH convs AS ($s$, $s$  WITH internal_cores AS (
    SELECT public.zapp_phone_core(i.phone_e164) AS pcore FROM public.zapp_internal_contacts i WHERE i.account_id = _account
    UNION
    SELECT public.zapp_phone_core(h.phone) FROM public.hr_collaborators h WHERE h.account_id = _account AND h.phone IS NOT NULL
  ),
  convs AS ($s$);
  EXECUTE n;
END
$mig$;