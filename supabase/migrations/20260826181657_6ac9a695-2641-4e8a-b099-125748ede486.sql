CREATE OR REPLACE FUNCTION public.search_active_event_clients(p_search text DEFAULT NULL, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone_e164 text,
  avatar_url text,
  emails jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, c.full_name, c.phone_e164, c.avatar_url, c.emails
  FROM public.clients c
  WHERE c.status IN ('active','paused','churn_risk')
    AND EXISTS (
      SELECT 1 FROM public.client_products cp
      WHERE cp.client_id = c.id AND cp.is_active = true
    )
    AND (
      p_search IS NULL
      OR length(trim(p_search)) < 2
      OR c.full_name ILIKE '%' || p_search || '%'
      OR c.phone_e164 ILIKE '%' || p_search || '%'
    )
  ORDER BY c.full_name
  LIMIT LEAST(COALESCE(p_limit, 50), 200);
$$;

GRANT EXECUTE ON FUNCTION public.search_active_event_clients(text, integer) TO authenticated;