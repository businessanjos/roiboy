CREATE OR REPLACE FUNCTION public.task_matches_tab(
  p_custom_status_id uuid, p_completed_at timestamptz, p_due_date date,
  p_tab text, p_today date, p_default_status_id uuid, p_completed_status_ids uuid[]
) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_tab IS NULL OR p_tab = '' THEN true
    WHEN p_tab = '__overdue__' THEN
      p_completed_at IS NULL
      AND NOT coalesce(p_custom_status_id = ANY(coalesce(p_completed_status_ids, '{}')), false)
      AND p_due_date IS NOT NULL AND p_due_date < p_today
    ELSE (
      (p_tab::uuid = ANY(coalesce(p_completed_status_ids, '{}')) OR p_completed_at IS NULL)
      AND (
        p_custom_status_id = p_tab::uuid
        OR (p_custom_status_id IS NULL AND p_tab::uuid = p_default_status_id AND p_completed_at IS NULL)
        OR (p_custom_status_id IS NULL AND p_completed_at IS NOT NULL
            AND p_tab::uuid = ANY(coalesce(p_completed_status_ids, '{}')))
      )
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.tasks_filtered(
  p_account_id uuid,
  p_search text,
  p_sector_id text,
  p_historical boolean,
  p_sector_activity_type_ids uuid[],
  p_filter_mode text,
  p_filter_user_id uuid,
  p_current_user_id uuid,
  p_activity_type_id uuid,
  p_stage_id uuid,
  p_negotiation text,
  p_date_start date,
  p_date_end date,
  p_ignore_date boolean
) RETURNS SETOF public.internal_tasks
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT t.*
  FROM public.internal_tasks t
  LEFT JOIN public.activity_types at ON at.id = t.activity_type_id
  WHERE t.account_id = p_account_id
    AND (p_historical OR p_sector_activity_type_ids IS NULL OR cardinality(p_sector_activity_type_ids) = 0
         OR t.activity_type_id = ANY(p_sector_activity_type_ids) OR t.activity_type_id IS NULL)
    AND (p_filter_mode <> 'mine' OR p_current_user_id IS NULL
         OR t.assigned_to = p_current_user_id OR t.created_by = p_current_user_id)
    AND (p_filter_mode <> 'user' OR p_filter_user_id IS NULL OR t.assigned_to = p_filter_user_id)
    AND (p_activity_type_id IS NULL OR t.activity_type_id = p_activity_type_id)
    AND (
      p_historical OR p_sector_id IS NULL OR p_sector_id = '' OR
      CASE p_sector_id
        WHEN 'vendas' THEN (at.sector_id = 'vendas'
          OR (at.sector_id IS NULL AND (t.deal_id IS NOT NULL OR t.lead_id IS NOT NULL)))
        WHEN 'operacoes' THEN (at.sector_id = 'operacoes'
          OR (at.sector_id IS NULL AND t.client_id IS NOT NULL AND t.deal_id IS NULL))
        ELSE coalesce(at.sector_id = p_sector_id, false)
      END
    )
    AND (
      p_ignore_date OR (p_date_start IS NULL AND p_date_end IS NULL) OR (
        t.due_date IS NOT NULL
        AND (p_date_start IS NULL OR t.due_date >= p_date_start)
        AND (p_date_end IS NULL OR t.due_date <= p_date_end)
      )
    )
    AND (p_stage_id IS NULL OR EXISTS (
      SELECT 1 FROM public.deals d WHERE d.id = t.deal_id AND d.stage_id = p_stage_id))
    AND (
      p_negotiation IS NULL OR p_negotiation = '' OR
      (p_negotiation LIKE 'deal:%' AND t.deal_id::text = substr(p_negotiation, 6)) OR
      (p_negotiation LIKE 'lead:%' AND t.deal_id IS NULL AND t.lead_id::text = substr(p_negotiation, 6))
    )
    AND (
      NULLIF(trim(coalesce(p_search, '')), '') IS NULL
      OR t.title ILIKE '%' || trim(p_search) || '%'
      OR t.description ILIKE '%' || trim(p_search) || '%'
      OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = t.client_id AND c.full_name ILIKE '%' || trim(p_search) || '%')
      OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = t.lead_id AND l.full_name ILIKE '%' || trim(p_search) || '%')
      OR EXISTS (SELECT 1 FROM public.deals dd WHERE dd.id = t.deal_id
                 AND (dd.title ILIKE '%' || trim(p_search) || '%' OR dd.contact_name ILIKE '%' || trim(p_search) || '%'))
      OR EXISTS (SELECT 1 FROM public.deals dd JOIN public.clients dc ON dc.id = dd.client_id
                 WHERE dd.id = t.deal_id AND dc.full_name ILIKE '%' || trim(p_search) || '%')
      OR EXISTS (SELECT 1 FROM public.deals dd JOIN public.leads dl ON dl.id = dd.lead_id
                 WHERE dd.id = t.deal_id AND dl.full_name ILIKE '%' || trim(p_search) || '%')
    )
$$;

CREATE OR REPLACE FUNCTION public.search_tasks_page2(
  p_account_id uuid,
  p_search text DEFAULT NULL,
  p_sector_id text DEFAULT NULL,
  p_historical boolean DEFAULT false,
  p_sector_activity_type_ids uuid[] DEFAULT NULL,
  p_filter_mode text DEFAULT 'all',
  p_filter_user_id uuid DEFAULT NULL,
  p_current_user_id uuid DEFAULT NULL,
  p_activity_type_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_negotiation text DEFAULT NULL,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_tab text DEFAULT NULL,
  p_today date DEFAULT NULL,
  p_default_status_id uuid DEFAULT NULL,
  p_completed_status_ids uuid[] DEFAULT NULL,
  p_sort_by text DEFAULT 'created_at',
  p_sort_direction text DEFAULT 'desc',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
) RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH f AS (
    SELECT t.id, t.priority::text AS priority, t.due_date, t.created_at,
           coalesce(lower(u.name), 'zzz') AS resp_key,
           coalesce(lower(ds.name), 'zzz') AS stage_key
    FROM public.tasks_filtered(
      p_account_id, p_search, p_sector_id, p_historical, p_sector_activity_type_ids,
      p_filter_mode, p_filter_user_id, p_current_user_id, p_activity_type_id,
      p_stage_id, p_negotiation, p_date_start, p_date_end, false
    ) t
    LEFT JOIN public.users u ON u.id = t.assigned_to
    LEFT JOIN public.deals d ON d.id = t.deal_id
    LEFT JOIN public.deal_stages ds ON ds.id = d.stage_id
    WHERE public.task_matches_tab(t.custom_status_id, t.completed_at, t.due_date, p_tab,
      coalesce(p_today, current_date), p_default_status_id, p_completed_status_ids)
  ),
  k AS (
    SELECT f.*,
      CASE f.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END AS prio_key,
      lower(coalesce(p_sort_direction, 'desc')) = 'asc' AS is_asc
    FROM f
  )
  SELECT k.id, count(*) OVER () AS total_count
  FROM k
  ORDER BY
    CASE WHEN p_sort_by = 'priority' AND k.is_asc THEN k.prio_key END ASC,
    CASE WHEN p_sort_by = 'priority' AND NOT k.is_asc THEN k.prio_key END DESC,
    CASE WHEN p_sort_by = 'due_date' AND k.is_asc THEN k.due_date END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'due_date' AND NOT k.is_asc THEN k.due_date END DESC NULLS FIRST,
    CASE WHEN p_sort_by = 'responsible' AND k.is_asc THEN k.resp_key END ASC,
    CASE WHEN p_sort_by = 'responsible' AND NOT k.is_asc THEN k.resp_key END DESC,
    CASE WHEN p_sort_by = 'stage' AND k.is_asc THEN k.stage_key END ASC,
    CASE WHEN p_sort_by = 'stage' AND NOT k.is_asc THEN k.stage_key END DESC,
    -- "Criação" segue a mesma semântica da tela: asc = mais recentes primeiro.
    CASE WHEN p_sort_by = 'created_at' AND NOT k.is_asc THEN k.created_at END ASC,
    k.created_at DESC,
    k.id DESC
  OFFSET greatest(p_offset, 0)
  LIMIT greatest(p_limit, 0)
$$;

CREATE OR REPLACE FUNCTION public.search_tasks_counts(
  p_account_id uuid,
  p_search text DEFAULT NULL,
  p_sector_id text DEFAULT NULL,
  p_historical boolean DEFAULT false,
  p_sector_activity_type_ids uuid[] DEFAULT NULL,
  p_filter_mode text DEFAULT 'all',
  p_filter_user_id uuid DEFAULT NULL,
  p_current_user_id uuid DEFAULT NULL,
  p_activity_type_id uuid DEFAULT NULL,
  p_stage_id uuid DEFAULT NULL,
  p_negotiation text DEFAULT NULL,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_today date DEFAULT NULL,
  p_default_status_id uuid DEFAULT NULL,
  p_completed_status_ids uuid[] DEFAULT NULL,
  p_status_ids uuid[] DEFAULT NULL,
  p_pending_status_id uuid DEFAULT NULL,
  p_pending_is_default boolean DEFAULT false,
  p_in_progress_status_id uuid DEFAULT NULL
) RETURNS TABLE (key text, n bigint)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH b AS MATERIALIZED (
    SELECT t.custom_status_id, t.completed_at, t.due_date FROM public.tasks_filtered(
      p_account_id, p_search, p_sector_id, p_historical, p_sector_activity_type_ids,
      p_filter_mode, p_filter_user_id, p_current_user_id, p_activity_type_id,
      p_stage_id, p_negotiation, p_date_start, p_date_end, false) t
  ),
  nb AS MATERIALIZED (
    SELECT t.custom_status_id, t.completed_at FROM public.tasks_filtered(
      p_account_id, p_search, p_sector_id, p_historical, p_sector_activity_type_ids,
      p_filter_mode, p_filter_user_id, p_current_user_id, p_activity_type_id,
      p_stage_id, p_negotiation, NULL, NULL, true) t
  )
  SELECT s.id::text, (SELECT count(*) FROM b WHERE public.task_matches_tab(b.custom_status_id, b.completed_at,
      b.due_date, s.id::text, coalesce(p_today, current_date), p_default_status_id, p_completed_status_ids))
  FROM unnest(coalesce(p_status_ids, '{}')) AS s(id)
  UNION ALL SELECT 'total', (SELECT count(*) FROM b)
  UNION ALL SELECT 'overdue', (SELECT count(*) FROM b WHERE public.task_matches_tab(b.custom_status_id,
      b.completed_at, b.due_date, '__overdue__', coalesce(p_today, current_date), p_default_status_id, p_completed_status_ids))
  UNION ALL SELECT 'pending', (SELECT count(*) FROM b WHERE b.completed_at IS NULL AND
      (b.custom_status_id = p_pending_status_id OR (b.custom_status_id IS NULL AND p_pending_status_id IS NOT NULL AND p_pending_is_default)))
  UNION ALL SELECT 'in_progress', (SELECT count(*) FROM b WHERE b.completed_at IS NULL AND b.custom_status_id = p_in_progress_status_id)
  UNION ALL SELECT 'done', (SELECT count(*) FROM nb WHERE
      (nb.completed_at IS NOT NULL OR coalesce(nb.custom_status_id = ANY(coalesce(p_completed_status_ids, '{}')), false))
      AND (
        (p_date_start IS NULL AND p_date_end IS NULL) OR (
          nb.completed_at IS NOT NULL
          AND (p_date_start IS NULL OR (nb.completed_at AT TIME ZONE 'UTC')::date >= p_date_start)
          AND (p_date_end IS NULL OR (nb.completed_at AT TIME ZONE 'UTC')::date <= p_date_end)
        )
      ))
$$;

REVOKE EXECUTE ON FUNCTION public.task_matches_tab(uuid, timestamptz, date, text, date, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_matches_tab(uuid, timestamptz, date, text, date, uuid, uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.tasks_filtered(uuid, text, text, boolean, uuid[], text, uuid, uuid, uuid, uuid, text, date, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tasks_filtered(uuid, text, text, boolean, uuid[], text, uuid, uuid, uuid, uuid, text, date, date, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_tasks_page2(uuid, text, text, boolean, uuid[], text, uuid, uuid, uuid, uuid, text, date, date, text, date, uuid, uuid[], text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_tasks_page2(uuid, text, text, boolean, uuid[], text, uuid, uuid, uuid, uuid, text, date, date, text, date, uuid, uuid[], text, text, int, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_tasks_counts(uuid, text, text, boolean, uuid[], text, uuid, uuid, uuid, uuid, text, date, date, date, uuid, uuid[], uuid[], uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_tasks_counts(uuid, text, text, boolean, uuid[], text, uuid, uuid, uuid, uuid, text, date, date, date, uuid, uuid[], uuid[], uuid, boolean, uuid) TO authenticated;