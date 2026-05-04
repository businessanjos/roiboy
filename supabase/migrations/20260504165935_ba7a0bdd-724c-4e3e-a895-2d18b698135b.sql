CREATE OR REPLACE FUNCTION public.get_avg_won_to_onboarding_days(
  p_account_id uuid,
  p_months_back integer DEFAULT 6
)
RETURNS TABLE (
  avg_days numeric,
  median_days numeric,
  sample_count integer,
  min_days numeric,
  max_days numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH onboarding_stage_ids AS (
    SELECT id FROM client_stages
    WHERE lower(name) LIKE '%onboarding com consultor%'
       OR lower(name) LIKE '%onboarding de ferramentas%'
  ),
  onboarding_items AS (
    SELECT id FROM stage_checklist_items
    WHERE stage_id IN (SELECT id FROM onboarding_stage_ids)
  ),
  first_completion AS (
    SELECT csc.client_id, MIN(csc.completed_at) AS completed_at
    FROM client_stage_checklist csc
    WHERE csc.account_id = p_account_id
      AND csc.checklist_item_id IN (SELECT id FROM onboarding_items)
      AND csc.completed_at IS NOT NULL
    GROUP BY csc.client_id
  ),
  first_won AS (
    SELECT d.client_id, MIN(d.won_at) AS won_at
    FROM deals d
    WHERE d.account_id = p_account_id
      AND d.status = 'won'
      AND d.won_at IS NOT NULL
      AND d.client_id IS NOT NULL
      AND d.won_at >= (now() - (p_months_back || ' months')::interval)
    GROUP BY d.client_id
  ),
  diffs AS (
    SELECT EXTRACT(EPOCH FROM (fc.completed_at - fw.won_at))/86400.0 AS days
    FROM first_won fw
    JOIN first_completion fc ON fc.client_id = fw.client_id
    WHERE fc.completed_at >= fw.won_at
  )
  SELECT
    ROUND(AVG(days)::numeric, 2),
    ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days))::numeric, 2),
    COUNT(*)::integer,
    ROUND(MIN(days)::numeric, 2),
    ROUND(MAX(days)::numeric, 2)
  FROM diffs;
$$;

GRANT EXECUTE ON FUNCTION public.get_avg_won_to_onboarding_days(uuid, integer) TO authenticated;