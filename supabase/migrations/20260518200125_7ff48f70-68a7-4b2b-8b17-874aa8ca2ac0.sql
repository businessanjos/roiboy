CREATE OR REPLACE FUNCTION public.get_ops_consultant_workload(
  p_days integer DEFAULT 7,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  avatar_url text,
  active_clients integer,
  clients_who_messaged integer,
  inbound_msgs integer,
  outbound_msgs integer,
  conversations integer,
  avg_first_response_min numeric,
  responded_inbound integer,
  total_inbound_with_window integer
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
  ops_users AS (
    SELECT u.id, u.name, u.email, u.avatar_url
    FROM users u
    LEFT JOIN team_roles tr ON tr.id = u.team_role_id
    WHERE u.is_active = true
      AND lower(coalesce(tr.name,'')) LIKE '%consultor%'
  ),
  active AS (
    SELECT c.responsible_user_id, count(*)::int AS n
    FROM clients c
    WHERE c.status = 'active' AND c.responsible_user_id IN (SELECT id FROM ops_users)
    GROUP BY c.responsible_user_id
  ),
  msgs AS (
    SELECT cl.responsible_user_id AS uid,
           m.direction,
           m.zapp_conversation_id,
           m.sent_at,
           cl.id AS client_id
    FROM zapp_messages m
    JOIN zapp_conversations zc ON zc.id = m.zapp_conversation_id
    JOIN clients cl ON cl.id = zc.client_id
    WHERE cl.responsible_user_id IN (SELECT id FROM ops_users)
      AND m.sent_at >= (SELECT ts_start FROM bounds)
      AND m.sent_at <  (SELECT ts_end FROM bounds)
  ),
  inbound_agg AS (
    SELECT uid, count(*)::int AS inbound,
           count(DISTINCT client_id)::int AS clients_msg,
           count(DISTINCT zapp_conversation_id)::int AS convs_in
    FROM msgs WHERE direction='inbound' GROUP BY uid
  ),
  outbound_agg AS (
    SELECT uid, count(*)::int AS outbound,
           count(DISTINCT zapp_conversation_id)::int AS convs_out
    FROM msgs WHERE direction='outbound' GROUP BY uid
  ),
  all_convs AS (
    SELECT uid, count(DISTINCT zapp_conversation_id)::int AS convs
    FROM msgs GROUP BY uid
  ),
  inbound_with_next AS (
    SELECT i.uid, i.sent_at AS in_at,
           (SELECT min(o.sent_at) FROM zapp_messages o
              WHERE o.zapp_conversation_id = i.zapp_conversation_id
                AND o.direction='outbound'
                AND o.sent_at > i.sent_at
                AND o.sent_at < i.sent_at + interval '12 hours') AS out_at
    FROM msgs i WHERE i.direction='inbound'
  ),
  resp_agg AS (
    SELECT uid,
           count(*) FILTER (WHERE out_at IS NOT NULL)::int AS responded,
           count(*)::int AS total_in,
           round(avg(extract(epoch FROM (out_at - in_at))/60.0) FILTER (WHERE out_at IS NOT NULL)::numeric, 1) AS avg_min
    FROM inbound_with_next GROUP BY uid
  )
  SELECT u.id, u.name, u.email, u.avatar_url,
    coalesce(a.n,0), coalesce(ia.clients_msg,0), coalesce(ia.inbound,0),
    coalesce(oa.outbound,0), coalesce(ac.convs,0),
    coalesce(ra.avg_min,0), coalesce(ra.responded,0), coalesce(ra.total_in,0)
  FROM ops_users u
  LEFT JOIN active a ON a.responsible_user_id = u.id
  LEFT JOIN inbound_agg ia ON ia.uid = u.id
  LEFT JOIN outbound_agg oa ON oa.uid = u.id
  LEFT JOIN all_convs ac ON ac.uid = u.id
  LEFT JOIN resp_agg ra ON ra.uid = u.id
  ORDER BY coalesce(a.n,0) DESC, u.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_ops_consultant_workload(integer, timestamptz, timestamptz) TO authenticated;