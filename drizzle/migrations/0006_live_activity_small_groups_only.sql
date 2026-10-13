CREATE OR REPLACE FUNCTION public.client_last_live_activity()
 RETURNS TABLE(client_id uuid, last_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH small_groups AS (
    SELECT conversation_id FROM public.zapp_group_clients GROUP BY conversation_id
    HAVING count(*) FILTER (WHERE source = 'auto') <= 5 OR bool_or(source = 'manual')
  )
  SELECT c.id AS client_id,
         GREATEST(
           COALESCE(msg.last_at, 'epoch'::timestamptz),
           COALESCE(grp.last_at, 'epoch'::timestamptz),
           COALESCE(ck.last_at, 'epoch'::timestamptz),
           COALESCE(c.recent_activity_at, 'epoch'::timestamptz)
         ) AS last_at
  FROM public.clients c
  LEFT JOIN LATERAL (
    SELECT max(m.sent_at) AS last_at FROM public.zapp_conversations zc
    JOIN public.zapp_messages m ON m.zapp_conversation_id = zc.id WHERE zc.client_id = c.id
  ) msg ON true
  LEFT JOIN LATERAL (
    SELECT max(zc.last_message_at) AS last_at FROM public.zapp_group_clients g
    JOIN small_groups s ON s.conversation_id = g.conversation_id
    JOIN public.zapp_conversations zc ON zc.id = g.conversation_id
    WHERE g.client_id = c.id AND (g.source = 'manual' OR g.conversation_id IN (
      SELECT conversation_id FROM public.zapp_group_clients GROUP BY conversation_id HAVING count(*) <= 5))
  ) grp ON true
  LEFT JOIN LATERAL (
    SELECT max(k.happened_at) AS last_at FROM public.client_checkins k WHERE k.client_id = c.id
  ) ck ON true
  WHERE c.status IN ('active','churn_risk','paused');
$function$;