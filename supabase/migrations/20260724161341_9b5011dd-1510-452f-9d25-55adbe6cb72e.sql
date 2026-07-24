
-- 1) Helper: user_has_sector_access
CREATE OR REPLACE FUNCTION public.user_has_sector_access(_auth_user_id uuid, _sector_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _auth_user_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.auth_user_id = _auth_user_id
          AND (u.role = 'admin' OR u.is_also_admin = true)
      )
      OR EXISTS (
        SELECT 1 FROM public.super_admins sa
        JOIN public.users u ON u.id = sa.user_id
        WHERE u.auth_user_id = _auth_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_sector_access usa
        JOIN public.users u ON u.id = usa.user_id
        WHERE u.auth_user_id = _auth_user_id
          AND usa.sector_id = _sector_id
          AND usa.is_active = true
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_sector_access(uuid, text) TO authenticated, anon, service_role;

-- 2) Restrictive policies per Sales-domain table.
--    Restrictive policies are ANDed with existing permissive policies,
--    so we don't need to rewrite the account-scoped ones.
DO $$
DECLARE
  tbl text;
  sales_tables text[] := ARRAY[
    'deals','deal_stages','deal_activities','deal_field_values',
    'deal_loss_reasons','deal_loss_sub_reasons','deal_operation_briefings',
    'leads','lead_field_values','lead_timeline','lead_duplicate_attempts',
    'pipelines','pipeline_filters',
    'sales_meetings','sales_history','sales_records',
    'sales_goals','sales_monthly_goals','sales_product_goals',
    'sales_goal_metrics','sales_quotas','sales_user_ote',
    'commission_deal_entries','commission_periods','commission_plans',
    'commission_tiers','commission_triggers','commission_sales_levels',
    'commission_approval_history',
    'sales_incentive_plans','sales_incentive_tiers','sales_incentive_product_rates',
    'sales_spiffs','spiff_spins','spiff_spin_requests',
    'sales_call_analyses','sales_chat_sessions','sales_chat_messages',
    'sales_dashboard_pinned_kpis','sales_team_careers'
  ];
BEGIN
  FOREACH tbl IN ARRAY sales_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'require_vendas_sector_access', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.user_has_sector_access(auth.uid(), %L)) WITH CHECK (public.user_has_sector_access(auth.uid(), %L))',
        'require_vendas_sector_access', tbl, 'vendas', 'vendas'
      );
    END IF;
  END LOOP;
END $$;
