
DROP FUNCTION IF EXISTS public.recalculate_consultant_bonus_payouts(int);

CREATE OR REPLACE FUNCTION public.recalculate_consultant_bonus_payouts(p_year int DEFAULT NULL)
RETURNS TABLE(processed int, target_year int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := COALESCE(p_year, EXTRACT(YEAR FROM now())::int);
  v_max_month int;
  v_goal RECORD;
  v_month int;
  v_actual numeric;
  v_monthly_target numeric;
  v_target numeric;
  v_achieved boolean;
  v_bonus numeric;
  v_count int := 0;
BEGIN
  v_max_month := CASE
    WHEN v_year < EXTRACT(YEAR FROM now())::int THEN 12
    WHEN v_year > EXTRACT(YEAR FROM now())::int THEN 0
    ELSE EXTRACT(MONTH FROM now())::int
  END;

  FOR v_goal IN SELECT cg.* FROM consultant_goals cg WHERE cg.year = v_year LOOP
    FOR v_month IN 1..v_max_month LOOP
      v_actual := public.compute_consultant_metric(
        v_goal.user_id, v_goal.product_id, v_year, v_month, v_goal.metric_type
      );
      v_monthly_target := COALESCE(
        (v_goal.monthly_targets ->> ((v_month - 1)::text))::numeric, 0
      );
      v_target := CASE WHEN v_monthly_target > 0 THEN v_monthly_target
                       ELSE COALESCE(v_goal.annual_target, 0) END;
      v_achieved := CASE
        WHEN v_target = 0 AND v_actual = 0 THEN false
        WHEN v_goal.metric_type = 'churn_rate' THEN v_actual <= v_target
        ELSE v_actual >= v_target
      END;
      v_bonus := CASE WHEN v_achieved THEN COALESCE(v_goal.bonus_amount, 0) ELSE 0 END;

      INSERT INTO consultant_bonus_payouts (
        account_id, goal_id, user_id, year, month,
        actual_value, achieved, bonus_paid, notes
      ) VALUES (
        v_goal.account_id, v_goal.id, v_goal.user_id, v_year, v_month,
        v_actual, v_achieved, v_bonus, 'auto-calculated'
      )
      ON CONFLICT (goal_id, year, month) DO UPDATE
        SET actual_value = EXCLUDED.actual_value,
            achieved = EXCLUDED.achieved,
            bonus_paid = EXCLUDED.bonus_paid,
            updated_at = now();

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_count, v_year;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_consultant_bonus_payouts(int) TO authenticated;
