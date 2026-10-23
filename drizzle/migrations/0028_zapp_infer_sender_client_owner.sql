CREATE OR REPLACE FUNCTION public.zapp_infer_sender(_cid uuid, _sent_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Envio sem atendente: herda quem atendeu perto dali, senão o dono da fila, senão a consultora responsável pelo cliente.
  SELECT coalesce(
    (SELECT p.sender_user_id FROM public.zapp_messages p
      WHERE p.zapp_conversation_id = _cid AND p.direction = 'outbound' AND p.sender_user_id IS NOT NULL
        AND p.sender_user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
        AND coalesce(p.is_deleted,false) = false
        AND p.sent_at <= _sent_at AND p.sent_at >= _sent_at - interval '7 days'
      ORDER BY p.sent_at DESC LIMIT 1),
    (SELECT p.sender_user_id FROM public.zapp_messages p
      WHERE p.zapp_conversation_id = _cid AND p.direction = 'outbound' AND p.sender_user_id IS NOT NULL
        AND p.sender_user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
        AND coalesce(p.is_deleted,false) = false
        AND p.sent_at > _sent_at AND p.sent_at <= _sent_at + interval '7 days'
      ORDER BY p.sent_at ASC LIMIT 1),
    (SELECT ag.user_id FROM public.zapp_conversation_assignments a
      JOIN public.zapp_agents ag ON ag.id = a.agent_id
      WHERE a.zapp_conversation_id = _cid AND a.agent_id IS NOT NULL
        AND ag.user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
      ORDER BY a.updated_at DESC NULLS LAST LIMIT 1),
    (SELECT cl.responsible_user_id FROM public.zapp_conversations c
      JOIN public.clients cl ON cl.id = c.client_id
      WHERE c.id = _cid AND cl.responsible_user_id IS NOT NULL
        AND cl.responsible_user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid),
    (SELECT min(cl.responsible_user_id::text)::uuid FROM public.zapp_group_clients g
      JOIN public.clients cl ON cl.id = g.client_id
      WHERE g.conversation_id = _cid AND cl.responsible_user_id IS NOT NULL
        AND cl.responsible_user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
      HAVING count(DISTINCT cl.responsible_user_id) = 1),
    (SELECT p.sender_user_id FROM public.zapp_messages p
      WHERE p.zapp_conversation_id = _cid AND p.direction = 'outbound' AND p.sender_user_id IS NOT NULL
        AND p.sender_user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
        AND coalesce(p.is_deleted,false) = false
        AND p.sent_at <= _sent_at
      ORDER BY p.sent_at DESC LIMIT 1)
  );
$function$;