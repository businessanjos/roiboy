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
      OR strpos(lower(t.title), lower(trim(p_search))) > 0
      OR strpos(lower(t.description), lower(trim(p_search))) > 0
      OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = t.client_id AND strpos(lower(c.full_name), lower(trim(p_search))) > 0)
      OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = t.lead_id AND strpos(lower(l.full_name), lower(trim(p_search))) > 0)
      OR EXISTS (SELECT 1 FROM public.deals dd WHERE dd.id = t.deal_id
                 AND (strpos(lower(dd.title), lower(trim(p_search))) > 0 OR strpos(lower(dd.contact_name), lower(trim(p_search))) > 0))
      OR EXISTS (SELECT 1 FROM public.deals dd JOIN public.clients dc ON dc.id = dd.client_id
                 WHERE dd.id = t.deal_id AND strpos(lower(dc.full_name), lower(trim(p_search))) > 0)
      OR EXISTS (SELECT 1 FROM public.deals dd JOIN public.leads dl ON dl.id = dd.lead_id
                 WHERE dd.id = t.deal_id AND strpos(lower(dl.full_name), lower(trim(p_search))) > 0)
    )
$$;