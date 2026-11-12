ALTER TABLE public.zapp_account_settings
  ADD COLUMN IF NOT EXISTS msg_hourly_limit integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS msg_today_limit integer,
  ADD COLUMN IF NOT EXISTS msg_today_date date;

CREATE OR REPLACE FUNCTION public.zapp_message_usage_today()
RETURNS TABLE(user_id uuid, user_name text, last_hour bigint, today bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.name,
    count(*) FILTER (WHERE m.created_at >= now() - interval '1 hour'),
    count(*)
  FROM zapp_messages m
  JOIN users u ON u.id = m.sender_user_id
  WHERE public.is_zapp_account_admin()
    AND m.account_id = public.get_user_account_id()
    AND m.direction = 'outbound'
    AND m.created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
  GROUP BY u.id, u.name
  ORDER BY 3 DESC, 4 DESC;
$$;
REVOKE ALL ON FUNCTION public.zapp_message_usage_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zapp_message_usage_today() TO authenticated;