CREATE OR REPLACE FUNCTION public.client_last_live_activity()
RETURNS TABLE (client_id uuid, last_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS client_id,
         GREATEST(
           COALESCE(msg.last_at, 'epoch'::timestamptz),
           COALESCE(ck.last_at, 'epoch'::timestamptz),
           COALESCE(c.recent_activity_at, 'epoch'::timestamptz)
         ) AS last_at
  FROM public.clients c
  LEFT JOIN LATERAL (
    SELECT max(m.sent_at) AS last_at
    FROM public.zapp_conversations zc
    JOIN public.zapp_messages m ON m.zapp_conversation_id = zc.id
    WHERE zc.client_id = c.id
  ) msg ON true
  LEFT JOIN LATERAL (
    SELECT max(k.happened_at) AS last_at
    FROM public.client_checkins k
    WHERE k.client_id = c.id
  ) ck ON true
  WHERE c.status IN ('active','churn_risk','paused');
$$;

REVOKE ALL ON FUNCTION public.client_last_live_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_last_live_activity() TO service_role;