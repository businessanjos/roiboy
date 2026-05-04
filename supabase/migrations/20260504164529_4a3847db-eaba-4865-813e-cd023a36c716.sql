
CREATE OR REPLACE FUNCTION public.compute_consultant_metric(
  p_user_id uuid,
  p_product_id uuid,
  p_year int,
  p_month int,
  p_metric text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := make_date(p_year, p_month, 1);
  v_end date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_renewed numeric;
  v_lost numeric;
  v_total numeric;
  v_cancelled numeric;
  v_active_start numeric;
  v_promoters numeric;
  v_detractors numeric;
  v_responses numeric;
BEGIN
  IF p_metric = 'renewal_rate' THEN
    SELECT
      COUNT(*) FILTER (WHERE ro.outcome = 'renewed'),
      COUNT(*) FILTER (WHERE ro.outcome = 'lost')
    INTO v_renewed, v_lost
    FROM renewal_outcomes ro
    JOIN client_contracts cc ON cc.id = ro.contract_id
    JOIN clients c ON c.id = ro.client_id
    WHERE ro.resolved_at >= v_start AND ro.resolved_at < v_end
      AND cc.product_id = p_product_id
      AND c.responsible_user_id = p_user_id;
    v_total := COALESCE(v_renewed, 0) + COALESCE(v_lost, 0);
    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN ROUND((COALESCE(v_renewed, 0) / v_total) * 100, 2);

  ELSIF p_metric = 'churn_rate' THEN
    SELECT COUNT(*) INTO v_cancelled
    FROM client_contracts cc
    JOIN clients c ON c.id = cc.client_id
    WHERE cc.product_id = p_product_id
      AND c.responsible_user_id = p_user_id
      AND cc.status IN ('cancelled','dismissed','dismissal_termination','dropout_7d')
      AND cc.cancelled_at IS NOT NULL
      AND cc.cancelled_at >= v_start
      AND cc.cancelled_at < v_end;

    SELECT COUNT(*) INTO v_active_start
    FROM client_contracts cc
    JOIN clients c ON c.id = cc.client_id
    WHERE cc.product_id = p_product_id
      AND c.responsible_user_id = p_user_id
      AND cc.start_date < v_start
      AND (cc.cancelled_at IS NULL OR cc.cancelled_at >= v_start)
      AND (cc.end_date IS NULL OR cc.end_date >= v_start);

    IF v_active_start = 0 THEN RETURN 0; END IF;
    RETURN ROUND((v_cancelled / v_active_start) * 100, 2);

  ELSIF p_metric = 'nps' THEN
    SELECT
      COUNT(*) FILTER (WHERE v.vnps_class::text = 'promoter'),
      COUNT(*) FILTER (WHERE v.vnps_class::text = 'detractor'),
      COUNT(*)
    INTO v_promoters, v_detractors, v_responses
    FROM vnps_snapshots v
    JOIN clients c ON c.id = v.client_id
    WHERE v.computed_at >= v_start AND v.computed_at < v_end
      AND c.responsible_user_id = p_user_id
      AND EXISTS (
        SELECT 1 FROM client_contracts cc
        WHERE cc.client_id = c.id
          AND cc.product_id = p_product_id
          AND cc.start_date < v_end
          AND (cc.cancelled_at IS NULL OR cc.cancelled_at >= v_start)
          AND (cc.end_date IS NULL OR cc.end_date >= v_start)
      );
    IF COALESCE(v_responses, 0) = 0 THEN RETURN 0; END IF;
    RETURN ROUND(((COALESCE(v_promoters,0) - COALESCE(v_detractors,0)) / v_responses) * 100, 2);
  END IF;

  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_consultant_metric(uuid, uuid, int, int, text) TO authenticated;
