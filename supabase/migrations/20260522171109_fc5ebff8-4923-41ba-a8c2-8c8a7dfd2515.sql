DROP FUNCTION IF EXISTS public.get_ops_consultant_workload(integer, timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_ops_consultant_workload(p_days integer DEFAULT 7, p_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(user_id uuid, name text, email text, avatar_url text, active_clients integer, clients_who_messaged integer, clients_attended integer, inbound_msgs integer, outbound_msgs integer, conversations integer, conversations_total integer, avg_first_response_min numeric, median_first_response_min numeric, total_response_time_min numeric, responded_inbound integer, total_inbound_with_window integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  clients_with_active_contract AS (
    SELECT DISTINCT cc.client_id FROM client_contracts cc WHERE cc.status = 'active'
  ),
  active AS (
    SELECT c.responsible_user_id, count(*)::int AS n
    FROM clients c
    WHERE c.responsible_user_id IN (SELECT id FROM ops_users)
      AND c.id IN (SELECT client_id FROM clients_with_active_contract)
    GROUP BY c.responsible_user_id
  ),
  msgs_all AS (
    SELECT cl.responsible_user_id AS uid,
           m.direction,
           m.zapp_conversation_id,
           m.sent_at,
           cl.id AS client_id,
           (cl.id IN (SELECT client_id FROM clients_with_active_contract)) AS has_active_contract
    FROM zapp_messages m
    JOIN zapp_conversations zc ON zc.id = m.zapp_conversation_id
    JOIN clients cl ON cl.id = zc.client_id
    WHERE cl.responsible_user_id IN (SELECT id FROM ops_users)
      AND m.sent_at >= (SELECT ts_start FROM bounds)
      AND m.sent_at <  (SELECT ts_end FROM bounds)
  ),
  msgs AS ( SELECT * FROM msgs_all WHERE has_active_contract ),
  inbound_agg AS (
    SELECT uid, count(*)::int AS inbound,
           count(DISTINCT client_id)::int AS clients_msg,
           count(DISTINCT zapp_conversation_id)::int AS convs_in
    FROM msgs WHERE direction='inbound' GROUP BY uid
  ),
  outbound_agg AS (
    SELECT uid, count(*)::int AS outbound,
           count(DISTINCT client_id)::int AS clients_att,
           count(DISTINCT zapp_conversation_id)::int AS convs_out
    FROM msgs WHERE direction='outbound' GROUP BY uid
  ),
  all_convs AS (
    SELECT uid, count(DISTINCT zapp_conversation_id)::int AS convs FROM msgs GROUP BY uid
  ),
  all_convs_total AS (
    SELECT uid, count(DISTINCT zapp_conversation_id)::int AS convs FROM msgs_all GROUP BY uid
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
           round(avg(extract(epoch FROM (out_at - in_at))/60.0) FILTER (WHERE out_at IS NOT NULL)::numeric, 1) AS avg_min,
           round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (out_at - in_at))/60.0) FILTER (WHERE out_at IS NOT NULL))::numeric, 1) AS median_min,
           round(sum(extract(epoch FROM (out_at - in_at))/60.0) FILTER (WHERE out_at IS NOT NULL)::numeric, 1) AS total_min
    FROM inbound_with_next GROUP BY uid
  )
  SELECT u.id, u.name, u.email, u.avatar_url,
    coalesce(a.n,0), coalesce(ia.clients_msg,0), coalesce(oa.clients_att,0),
    coalesce(ia.inbound,0), coalesce(oa.outbound,0), coalesce(ac.convs,0),
    coalesce(act.convs,0),
    coalesce(ra.avg_min,0), coalesce(ra.median_min,0), coalesce(ra.total_min,0),
    coalesce(ra.responded,0), coalesce(ra.total_in,0)
  FROM ops_users u
  LEFT JOIN active a ON a.responsible_user_id = u.id
  LEFT JOIN inbound_agg ia ON ia.uid = u.id
  LEFT JOIN outbound_agg oa ON oa.uid = u.id
  LEFT JOIN all_convs ac ON ac.uid = u.id
  LEFT JOIN all_convs_total act ON act.uid = u.id
  LEFT JOIN resp_agg ra ON ra.uid = u.id
  ORDER BY coalesce(a.n,0) DESC, u.name;
$function$;