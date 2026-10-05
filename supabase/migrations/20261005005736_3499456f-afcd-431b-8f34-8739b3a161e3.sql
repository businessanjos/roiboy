CREATE OR REPLACE FUNCTION public.get_notification_tab_counts(p_user_id uuid)
RETURNS TABLE (tab text, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT n.source_type
    FROM public.notifications n
    WHERE n.user_id = p_user_id AND n.is_read = false
  ),
  tabbed AS (
    SELECT CASE
        WHEN source_type IN ('deal', 'contract_renewal', 'client_contracts') THEN 'sales'
        WHEN source_type IN ('client_checkpoint', 'client_checkpoint_digest') THEN 'checkpoints'
        WHEN source_type = 'form_response' THEN 'forms'
        WHEN source_type = 'client_followup' THEN 'mentions'
        ELSE 'other'
      END AS tab
    FROM base
  )
  SELECT 'all'::text, count(*)::bigint FROM base
  UNION ALL
  SELECT t.tab, count(tabbed.tab)::bigint
  FROM (SELECT unnest(ARRAY['sales','checkpoints','forms','mentions','other']) AS tab) t
  LEFT JOIN tabbed ON tabbed.tab = t.tab
  GROUP BY t.tab;
$$;

GRANT EXECUTE ON FUNCTION public.get_notification_tab_counts(uuid) TO authenticated;