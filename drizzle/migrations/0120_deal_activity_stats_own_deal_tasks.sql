CREATE OR REPLACE FUNCTION public.get_deal_activity_stats(p_deal_ids uuid[])
RETURNS TABLE(deal_id uuid, total_activities integer, pending_count integer, has_overdue boolean, next_due_date date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH deal_scope AS (
    SELECT d.id AS deal_id, d.lead_id, d.client_id
    FROM public.deals d
    WHERE d.id = ANY(p_deal_ids)
  ),
  -- Tasks of this deal, plus tasks with no deal linked to the same lead/client.
  -- A task that belongs to another deal never counts here.
  task_matches AS (
    SELECT DISTINCT
      ds.deal_id,
      t.id AS task_id,
      t.due_date,
      t.completed_at,
      COALESCE(ts.is_completed_status, false) AS status_completed
    FROM deal_scope ds
    JOIN public.internal_tasks t
      ON t.deal_id = ds.deal_id
      OR (
        t.deal_id IS NULL
        AND (
          (ds.lead_id IS NOT NULL AND t.lead_id = ds.lead_id)
          OR (ds.client_id IS NOT NULL AND t.client_id = ds.client_id)
        )
      )
    LEFT JOIN public.task_statuses ts ON ts.id = t.custom_status_id
  ),
  activity_matches AS (
    SELECT ds.deal_id, a.id AS activity_id
    FROM deal_scope ds
    JOIN public.deal_activities a ON a.deal_id = ds.deal_id
    WHERE lower(COALESCE(a.type, '')) IN ('call','whatsapp','email','meeting','image','file')
       OR (
         lower(COALESCE(a.type, '')) = 'note'
         AND (COALESCE(btrim(a.title), '') = '' OR lower(btrim(a.title)) = 'nota')
       )
  ),
  task_stats AS (
    SELECT
      deal_id,
      COUNT(*)::int AS task_count,
      COUNT(*) FILTER (WHERE completed_at IS NULL AND NOT status_completed)::int AS pending_count,
      bool_or(
        due_date IS NOT NULL
        AND due_date < CURRENT_DATE
        AND completed_at IS NULL
        AND NOT status_completed
      ) AS has_overdue,
      MIN(due_date) FILTER (
        WHERE completed_at IS NULL AND NOT status_completed
      ) AS next_due_date
    FROM task_matches
    GROUP BY deal_id
  ),
  activity_stats AS (
    SELECT deal_id, COUNT(*)::int AS activity_count
    FROM activity_matches
    GROUP BY deal_id
  )
  SELECT
    ds.deal_id,
    (COALESCE(ts.task_count, 0) + COALESCE(a.activity_count, 0))::int AS total_activities,
    COALESCE(ts.pending_count, 0)::int AS pending_count,
    COALESCE(ts.has_overdue, false) AS has_overdue,
    ts.next_due_date
  FROM deal_scope ds
  LEFT JOIN task_stats ts ON ts.deal_id = ds.deal_id
  LEFT JOIN activity_stats a ON a.deal_id = ds.deal_id;
$function$;