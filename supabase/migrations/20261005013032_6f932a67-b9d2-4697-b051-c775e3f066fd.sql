CREATE OR REPLACE FUNCTION public.search_tasks_page(
  p_account_id uuid,
  p_search text DEFAULT NULL,
  p_sector_activity_type_ids uuid[] DEFAULT NULL,
  p_apply_sector_filter boolean DEFAULT false,
  p_filter_mode text DEFAULT 'all',
  p_filter_user_id uuid DEFAULT NULL,
  p_current_user_id uuid DEFAULT NULL,
  p_custom_status_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_deal_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_sort_by text DEFAULT 'created_at',
  p_sort_direction text DEFAULT 'desc',
  p_limit int DEFAULT 1000,
  p_offset int DEFAULT 0
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_search text;
  v_sort_dir text;
BEGIN
  v_search := NULLIF(trim(coalesce(p_search, '')), '');
  v_sort_dir := CASE WHEN lower(coalesce(p_sort_direction, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;

  RETURN QUERY EXECUTE format(
    $f$
      SELECT t.id, count(*) OVER() AS total_count
      FROM public.internal_tasks t
      WHERE t.account_id = $1
        AND ($2 = false OR $3 IS NULL OR t.activity_type_id = ANY($3) OR t.activity_type_id IS NULL)
        AND ($4 <> 'mine' OR $5 IS NULL OR t.assigned_to = $5 OR t.created_by = $5)
        AND ($4 <> 'user' OR $6 IS NULL OR t.assigned_to = $6)
        AND ($7 IS NULL OR t.custom_status_id = $7)
        AND ($8 IS NULL OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = t.deal_id AND d.stage_id = $8))
        AND ($9 IS NULL OR t.deal_id = $9)
        AND ($10 IS NULL OR (t.lead_id = $10 AND t.deal_id IS NULL))
        AND ($11 IS NULL OR t.due_date >= $11)
        AND ($12 IS NULL OR t.due_date <= $12)
        AND (
          $13 IS NULL
          OR t.title ILIKE '%%' || $13 || '%%'
          OR t.description ILIKE '%%' || $13 || '%%'
          OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = t.client_id AND c.full_name ILIKE '%%' || $13 || '%%')
          OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = t.lead_id AND l.full_name ILIKE '%%' || $13 || '%%')
          OR EXISTS (SELECT 1 FROM public.deals dd WHERE dd.id = t.deal_id AND dd.title ILIKE '%%' || $13 || '%%')
          OR EXISTS (SELECT 1 FROM public.deals dd WHERE dd.id = t.deal_id AND dd.contact_name ILIKE '%%' || $13 || '%%')
          OR EXISTS (
            SELECT 1 FROM public.deals dd
            JOIN public.clients dc ON dc.id = dd.client_id
            WHERE dd.id = t.deal_id AND dc.full_name ILIKE '%%' || $13 || '%%'
          )
          OR EXISTS (
            SELECT 1 FROM public.deals dd
            JOIN public.leads dl ON dl.id = dd.lead_id
            WHERE dd.id = t.deal_id AND dl.full_name ILIKE '%%' || $13 || '%%'
          )
        )
      ORDER BY
        CASE WHEN %L = 'due_date' AND %L = 'asc' THEN t.due_date END ASC NULLS LAST,
        CASE WHEN %L = 'due_date' AND %L = 'desc' THEN t.due_date END DESC NULLS LAST,
        CASE WHEN %L = 'created_at' AND %L = 'asc' THEN t.created_at END ASC,
        CASE WHEN %L = 'created_at' AND %L = 'desc' THEN t.created_at END DESC,
        t.id DESC
      LIMIT $14 OFFSET $15
    $f$,
    p_sort_by, v_sort_dir, p_sort_by, v_sort_dir, p_sort_by, v_sort_dir, p_sort_by, v_sort_dir
  )
  USING
    p_account_id, p_apply_sector_filter, p_sector_activity_type_ids,
    p_filter_mode, p_current_user_id, p_filter_user_id, p_custom_status_id,
    p_stage_id, p_deal_id, p_lead_id, p_date_start, p_date_end, v_search,
    p_limit, p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_tasks_page(
  uuid, text, uuid[], boolean, text, uuid, uuid, uuid, uuid, uuid, uuid, date, date, text, text, int, int
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_tasks_page(
  uuid, text, uuid[], boolean, text, uuid, uuid, uuid, uuid, uuid, uuid, date, date, text, text, int, int
) TO authenticated;

DROP FUNCTION IF EXISTS public.search_security_audit(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_security_audit(
  p_account_id uuid,
  p_event_type text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid, event_type text, user_id uuid, account_id uuid, ip_address text,
  user_agent text, details jsonb, created_at timestamptz, total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id, s.event_type, s.user_id, s.account_id, s.ip_address, s.user_agent,
         s.details, s.created_at, count(*) OVER() AS total_count
  FROM public.security_audit_logs s
  WHERE s.account_id = p_account_id
    AND (p_event_type IS NULL OR p_event_type = 'all' OR s.event_type = p_event_type)
    AND (
      p_search IS NULL OR p_search = '' OR
      s.event_type ILIKE '%' || p_search || '%' OR
      s.ip_address ILIKE '%' || p_search || '%' OR
      s.details::text ILIKE '%' || p_search || '%'
    )
  ORDER BY s.created_at DESC, s.id DESC
  OFFSET p_offset
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.search_security_audit(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_security_audit(uuid, text, text, integer, integer) TO authenticated;