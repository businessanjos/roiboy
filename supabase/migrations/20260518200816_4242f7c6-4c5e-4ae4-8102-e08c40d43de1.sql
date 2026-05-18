CREATE OR REPLACE FUNCTION public.get_ops_consultant_clients_breakdown(
  p_user_id uuid,
  p_days integer DEFAULT 7,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  logo_url text,
  inbound_msgs integer,
  outbound_msgs integer,
  last_inbound_at timestamptz,
  conversations integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      COALESCE(p_start, now() - make_interval(days => p_days)) AS ts_start,
      COALESCE(p_end, now()) AS ts_end
  ),
  base_clients AS (
    SELECT c.id, COALESCE(NULLIF(c.full_name,''), c.company_name, 'Sem nome') AS name, c.logo_url
    FROM clients c
    WHERE c.status = 'active' AND c.responsible_user_id = p_user_id
  ),
  msgs AS (
    SELECT zc.client_id, m.direction, m.zapp_conversation_id, m.sent_at
    FROM zapp_messages m
    JOIN zapp_conversations zc ON zc.id = m.zapp_conversation_id
    WHERE zc.client_id IN (SELECT id FROM base_clients)
      AND m.sent_at >= (SELECT ts_start FROM bounds)
      AND m.sent_at <  (SELECT ts_end FROM bounds)
  ),
  agg AS (
    SELECT client_id,
      count(*) FILTER (WHERE direction='inbound')::int AS inbound,
      count(*) FILTER (WHERE direction='outbound')::int AS outbound,
      max(sent_at) FILTER (WHERE direction='inbound') AS last_in,
      count(DISTINCT zapp_conversation_id)::int AS convs
    FROM msgs GROUP BY client_id
  )
  SELECT bc.id, bc.name, bc.logo_url,
    coalesce(a.inbound,0), coalesce(a.outbound,0), a.last_in, coalesce(a.convs,0)
  FROM base_clients bc
  LEFT JOIN agg a ON a.client_id = bc.id
  ORDER BY coalesce(a.inbound,0) DESC, bc.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_ops_consultant_clients_breakdown(uuid, integer, timestamptz, timestamptz) TO authenticated;