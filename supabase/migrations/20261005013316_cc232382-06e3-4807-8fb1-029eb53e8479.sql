DROP FUNCTION IF EXISTS public.zapp_attendance_daily(uuid, timestamptz);

CREATE OR REPLACE FUNCTION public.zapp_attendance_daily(
  p_account_id uuid,
  p_since timestamptz,
  p_tz text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE (day date, messages bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT (m.sent_at AT TIME ZONE p_tz)::date AS day, count(*) AS messages
  FROM zapp_messages m
  WHERE m.account_id = p_account_id AND m.direction = 'outbound'
    AND m.sender_user_id IS NOT NULL AND m.sent_at >= p_since
  GROUP BY 1
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION public.zapp_attendance_daily(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zapp_attendance_daily(uuid, timestamptz, text) TO authenticated;